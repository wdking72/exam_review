// 是组装中心，把之前写的几个模块拼起来启动服务。
import Koa from 'koa'
import { bodyParser } from '@koa/bodyparser'
import { initRag } from '../rag/init-rag.js' 
import { createHealthRouter } from './routes/health.js'
import { createChatRouter } from './routes/chat.js'

// 初始化Rag知识库

export async function startServer(){
  const ragEngine = await initRag()

  const app = new Koa() // 创建 Koa 实例
  // cors跨域处理
  app.use(async (ctx, next) => {
    ctx.set("Access-Control-Allow-Origin", "*")
    ctx.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    ctx.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    if (ctx.method === "OPTIONS") {
      ctx.status = 204
      return
    }
    await next()
  })
  app.use(bodyParser()) // 解析请求体
  const healthRouter = createHealthRouter(ragEngine)
  const chatRouter = createChatRouter(ragEngine)

  app.use(healthRouter.routes())
  app.use(healthRouter.allowedMethods())    
  app.use(chatRouter.routes())
  app.use(chatRouter.allowedMethods())
  const PORT = parseInt(process.env.PORT ?? "3001", 10)
  return new Promise<void>((resolve, reject) => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
      resolve()
    })
  })
}
