import type { Middleware } from "koa";
/**
 * 校验 ctx.request.body 是否包含指定的字段。
 * 用法： validateBody('message', 'title')
 */
export function validateBody(...fields: string[]): Middleware {
  return async (ctx, next) => {
    const body = ctx.request.body as Record<string, unknown>
    for (const field of fields) {
      if (!body || body[field] === undefined) {
        ctx.status = 400
        ctx.body = {
          error: {
            code: "VALIDATION_ERROR",
            message: `${field} is required`
          }
        }
        return // 短路，不调用next()
      }
    }
    await next() // 继续调用下一个中间件
  }
}