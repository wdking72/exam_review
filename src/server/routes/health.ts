// 提供一个 GET /api/health 端点，让前端（或者运维监控）确认后端是否活着，以及 RAG 知识库是否就绪。
import Router from "@koa/router"
import type { Context } from "koa"
import type { RAGEngine } from "../../rag/rag-engine.js"

export function createHealthRouter(ragEngine?: RAGEngine) {
  const router = new Router({ prefix: '/api' })
  router.get('/health', (ctx: Context) => {
    ctx.body = {
      status: 'ok', // 后端状态
      ragLoaded: ragEngine !== undefined, // RAG 知识库是否就绪。
    }
    ctx.status = 200
  })
  return router // 返回路由实例
}
