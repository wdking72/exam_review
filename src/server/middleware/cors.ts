import { Middleware } from "koa";

//  为什么用函数包一层？ 因为将来你可能想传参数进去，比如 cors({ origin: 'http://localhost:3000' }) 而不是写死，函数式中间件更灵活。
export function cors(): Middleware {
  return async (ctx, next) => {
    ctx.set("Access-Control-Allow-Origin", "*")
    ctx.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    ctx.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    if (ctx.method === "OPTIONS") { 
      ctx.status = 204
      return
    }
    await next()
  }
}