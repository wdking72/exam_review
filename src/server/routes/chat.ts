// 提供一个 POST /api/chat/stream 接口，前端发来用户消息，后端用 Agent 流式回答，通过 SSE 推回去。
import Router from "@koa/router"
import { NativeToolAgent } from "../../core/agent-native.js"
import { MemoryManager } from "../../core/memory.js"
import { createTools } from "../../tools/tools.js"
import { createSSEStream, sendSSEEvent } from "../sse.js"
import type { RAGEngine } from "../../rag/rag-engine.js"
import type { Context } from "koa"
import { validateBody } from "../middleware/validate.js"

// const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.siliconflow.cn/v1"
// const API_KEY      = process.env.API_KEY ?? ""
// const MODEL        = process.env.MODEL ?? "nex-agi/Nex-N2-Pro"
// const SYSTEM_PROMPT = `你是一个期末复习助手，帮助大学生准备考试。你有工具可用，需要时使用它们，不需要时直接回答。始终用中文回答。`

export function createChatRouter(ragEngine?: RAGEngine) {
  const router = new Router({ prefix: '/api' })
  // FIX: 跨请求保留 memory,按 conversationId 索引
  // 证据: debug-memory-lost-on-continue 中"继续"丢失上下文,根因是每次请求 new MemoryManager()
  const conversationStore = new Map<string, MemoryManager>();
  router.post('/chat/stream', validateBody('message'), async (ctx: Context) => {
    const { message, useRag = false, conversationId = "default" } = ctx.request.body as {
      message: string,
      useRag: boolean,
      conversationId?: string
    }
    // 创建sse：直接操作 ctx.res，不经过 Koa stream pipe
    const res = createSSEStream(ctx)
    // FIX: 同一 conversationId 复用 memory,避免"继续"时丢失上下文
    let memory = conversationStore.get(conversationId);
    if (!memory) {
      memory = new MemoryManager({ strategy: "sliding-window", maxTurns: 10 });
      conversationStore.set(conversationId, memory);
    }
    // 创建agent
    try {
    const agent = new NativeToolAgent({
      baseURL: process.env.API_BASE_URL!,
      apiKey: process.env.API_KEY!,
      model: process.env.MODEL!,
      memory,
      registry: createTools(useRag ? ragEngine : undefined),
    })
    agent.init(process.env.SYSTEM_PROMPT!)
    // 需要等待 agent.streamChat 完成，才能结束流
    //
    // 【流式关键】agent.streamChat 内部使用 OpenAI SDK 的 stream: true，
    // 理论上会逐 token 调用此回调。如果回调是按 token 触发的，
    // 但前端仍是一次性出现，说明数据在 sendSSEEvent() 之后被缓冲，
    // 而不是在这里没有逐 token 生成。请按 sse.ts 里的排查顺序定位。
    await agent.streamChat(message, (chunk) => {
      // 根据 chunk类型，选择不同的事件名
      const eventName = chunk.type === "done" ? "done" : "token"
      // 发送事件：直接写入 ctx.res，数据立即到达客户端
      // FIX: done 事件带 truncated 字段,前端用 truncated 决定是否显示"继续生成"按钮
      sendSSEEvent(res, eventName, JSON.stringify(chunk))
    })
    }
    catch (error: any) {
      sendSSEEvent(res, "error", JSON.stringify({type: "error", content: error.message}))
    } finally {
      res.end()
    }
  })
  return router // 返回路由实例
}
