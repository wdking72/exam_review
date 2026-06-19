import type { Middleware } from "koa";
// 日志中间件
export function logger(): Middleware {
  return async (ctx, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    console.log(`${ctx.method} ${ctx.url}-${ctx.status} - ${ms}ms`)
  }
}