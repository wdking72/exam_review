import { ref } from 'vue'

interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string
}

export function useChat() {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const sendMessage = async (content: string) => {
    // 添加用户消息
    messages.value.push({ role: 'user', content })
    isLoading.value = true
    error.value = null

    // 添加助手消息占位符
    const assistantMessage: Message = { role: 'assistant', content: '' }
    messages.value.push(assistantMessage)

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          useRag: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No reader available')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // 下一行是 data
            continue
          }
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'text') {
                assistantMessage.content += parsed.content
              } else if (parsed.type === 'tool') {
                // 工具调用可以特殊处理，这里简单追加
                assistantMessage.content += `\n[工具调用] ${parsed.content}\n`
              } else if (parsed.type === 'done') {
                // 流结束
                break
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发生未知错误'
      // 移除空的助手消息
      messages.value.pop()
    } finally {
      isLoading.value = false
    }
  }

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  }
}