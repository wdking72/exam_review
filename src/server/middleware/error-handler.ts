import type { Middleware } from "koa";
// 错误处理中间件
export function errorHandler(): Middleware {
  return async (ctx, next) => {
    try {
      await next()
    } catch (error: any) {
      ctx.status = error.status ?? 500
      ctx.body = {
        error: {
          code: error.code ?? "INTERNAL_ERROR",
          message: error.message ?? "Internal Server Error"
        }
      }
      // 记录错误日志
      console.error(`[Error] ${ctx.method} ${ctx.url}:`, error.message)
    }
  }
}