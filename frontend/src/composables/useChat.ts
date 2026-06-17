import { ref, nextTick } from 'vue'

// ============================================================================
// 流式对话核心 Composable
// ============================================================================
//
// 【核心架构】
//   前端 (useChat)  →  POST /api/chat/stream  →  后端 (Koa + Agent)
//        ↑                                              │
//        └──────────── SSE (Server-Sent Events) ────────┘
//
// 【SSE 协议格式】
//   后端通过 SSE 按行推送事件，每条事件由 "event:" + "data:" + 空行组成：
//
//     event: token          ← 事件类型（token / done / error）
//     data: {"type":"text","content":"你"}   ← JSON 载荷
//                                                    ← 空行表示事件结束
//     event: token
//     data: {"type":"tool","content":"..."}
//
//     event: done
//     data: {"type":"done","content":"完整回答"}
//
// 【前端处理流程】
//   1. fetch() 发起 POST 请求，获取 ReadableStream
//   2. 通过 reader.read() 循环读取二进制 chunk
//   3. TextDecoder 将二进制解码为字符串，追加到 buffer
//   4. 按 "\n" 分割 buffer，逐行解析 "event:" 和 "data:" 前缀
//   5. 根据 chunk.type 将内容追加到对应的 UI 消息中
//   6. 收到 "done" 时结束循环
//
// 【为什么用 SSE 而不是 WebSocket】
//   - SSE 是单向推送（服务端→客户端），正好满足 LLM 流式输出场景
//   - 基于 HTTP，天然支持 CORS、代理、负载均衡
//   - 浏览器原生 EventSource API 可用，但这里用 fetch+ReadableStream 是因为
//     EventSource 只支持 GET 请求，而我们需要 POST 发送消息体
//
// 【为什么用 fetch ReadableStream 而不是 EventSource】
//   - EventSource 只支持 GET，无法 POST JSON body
//   - ReadableStream 给我们完全的控制权：中断、超时、错误处理
// ============================================================================

/** 消息角色类型 */
interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string
}

/** 后端 SSE 推送的 chunk 结构 */
interface StreamChunk {
  type: 'text' | 'tool' | 'done' | 'error'
  content: string
}

export function useChat() {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // AbortController 用于取消进行中的请求
  // 每次 sendMessage 创建新的，取消时调用 abort()
  let abortController: AbortController | null = null

  /**
   * 发送消息并处理 SSE 流式响应
   *
   * 核心步骤：
   * 1. 立即在 UI 显示用户消息和助手占位符（乐观更新）
   * 2. fetch POST 请求后端，获取 ReadableStream
   * 3. 循环 reader.read() 读取二进制 chunk
   * 4. 解码→缓冲→按行解析→追加到助手消息
   * 5. 流结束后清理状态
   */
  const sendMessage = async (content: string) => {
    // ---- Step 1: 乐观更新 ----
    // 先把用户消息和空的助手消息推入列表，用户立刻看到对话气泡
    // 助手消息的 content 会在流式接收过程中被逐步填充
    messages.value.push({ role: 'user', content })
    messages.value.push({ role: 'assistant', content: '' })

    // 记录助手消息在数组中的索引，后续通过 messages.value[idx] 访问
    // 【关键】必须通过响应式数组访问元素，不能用局部变量引用
    // 因为 push 进 ref 数组后，Vue 会把元素包装成 Proxy，
    // 局部变量仍指向原始对象，直接修改不会触发响应式更新
    const assistantIdx = messages.value.length - 1

    isLoading.value = true
    error.value = null

    // 创建新的 AbortController，支持取消
    abortController = new AbortController()

    try {
      // ---- Step 2: 发起 SSE 请求 ----
      // 注意：不能用 EventSource（只支持 GET），必须用 fetch + POST
      //
      // 【修复】开发环境直接请求后端，绕过 Vite 代理。
      //   Vite 开发服务器的 http-proxy 会缓冲 SSE 响应，导致浏览器端
      //   等到整段回答结束后才一次性收到数据，无法逐字流式显示。
      //   生产环境仍然走相对路径 /api/chat/stream，由 Nginx/部署平台统一代理。
      //   使用 127.0.0.1 而不是 localhost，避免 Windows/浏览器把 localhost
      //   解析到 IPv6 ::1 而 Node 只监听 IPv4 导致 404 的问题。
      const apiUrl = import.meta.env.DEV
        ? 'http://127.0.0.1:3001/api/chat/stream'
        : '/api/chat/stream'

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, useRag: true }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // ---- Step 3: 获取 ReadableStream reader ----
      // response.body 是一个 ReadableStream，通过 getReader() 获取逐块读取器
      // 每次 read() 返回 { done: boolean, value: Uint8Array }
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      // buffer 用于处理跨 chunk 的不完整行
      // 例如：chunk1 以 "event: t" 结尾，chunk2 以 "oken\ndata:..." 开头
      // 需要拼接后再按 "\n" 分割
      let buffer = ''

      // ---- Step 4: 循环读取 chunk ----
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // 将二进制 chunk 解码为字符串，stream: true 表示可能有多段
        buffer += decoder.decode(value, { stream: true })

        // 按换行符分割，最后一段可能是不完整的行，保留在 buffer 中
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        // ---- Step 5: 逐行解析 SSE 格式 ----
        // SSE 格式：每条事件由 "event: xxx" + "data: xxx" + 空行组成
        // 我们忽略 event 行（后端的事件类型已经编码在 data JSON 的 type 字段中）
        // 只解析 "data:" 行
        for (const line of lines) {
          const trimmed = line.trim()

          // 跳过空行和 event 行
          if (!trimmed || trimmed.startsWith('event:')) continue

          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim()
            if (!jsonStr) continue

            try {
              const chunk: StreamChunk = JSON.parse(jsonStr)

              switch (chunk.type) {
                case 'text':
                  // 文本 token：逐步追加到助手消息
                  // 【关键】通过 messages.value[idx] 访问，走 Vue Proxy 的 setter，
                  // 才能触发响应式更新，驱动视图重新渲染
                  messages.value[assistantIdx].content += chunk.content
                  // 不 await，避免阻塞下一次 read()，滚动异步执行即可
                  scrollToBottom()
                  break

                case 'tool':
                  // 工具调用结果：以特殊格式追加，便于用户识别
                  messages.value[assistantIdx].content += `\n${chunk.content}\n`
                  scrollToBottom()
                  break

                case 'done':
                  // 流结束：content 包含最终完整回答
                  // 前面的 text token 已经逐步拼接出了完整内容，这里不需要额外处理
                  break

                case 'error':
                  // 后端主动推送的错误（如 Agent 执行异常）
                  throw new Error(chunk.content)
              }
            } catch (e) {
              // JSON 解析失败通常是因为收到了非 JSON 格式的 data
              // （如后端直接推送纯文本），静默忽略
              if (e instanceof Error && e.message.startsWith('HTTP')) {
                throw e // 重新抛出我们自己构造的错误
              }
            }
          }
        }
      }
    } catch (e: any) {
      // ---- 错误处理 ----
      if (e.name === 'AbortError') {
        // 用户主动取消
        messages.value[assistantIdx].content += '\n\n[已取消]'
        return
      }
      error.value = e instanceof Error ? e.message : '发生未知错误'
      // 移除空的助手消息（出错时不应该留空白气泡）
      if (!messages.value[assistantIdx].content) {
        messages.value.splice(assistantIdx, 1)
      }
    } finally {
      isLoading.value = false
      abortController = null
    }
  }

  /**
   * 取消正在进行的流式请求
   * 调用 abortController.abort() 会触发 fetch 的 AbortError
   */
  const cancelMessage = () => {
    abortController?.abort()
  }

  /**
   * 滚动到消息列表底部
   * 使用 nextTick 确保 DOM 已更新后再滚动
   */
  const scrollToBottom = async () => {
    await nextTick()
    const container = document.querySelector('.overflow-y-auto')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    cancelMessage,
  }
}
