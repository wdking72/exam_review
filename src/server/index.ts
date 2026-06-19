// 是组装中心，把之前写的几个模块拼起来启动服务。
import Koa from 'koa'
import { bodyParser } from '@koa/bodyparser'
import { initRag } from '../rag/init-rag.js' 
import { createHealthRouter } from './routes/health.js'
import { createChatRouter } from './routes/chat.js'
import { cors } from './middleware/cors.js'
import { errorHandler } from './middleware/error-handler.js'
import { logger } from './middleware/logger.js'
import { loadConfig } from './config.js'

// 初始化Rag知识库

export async function startServer(){
  // 配置检查
  const config = loadConfig()
  const ragEngine = await initRag()
  const healthRouter = createHealthRouter(ragEngine)
  const chatRouter = createChatRouter(ragEngine, config)

  const app = new Koa() // 创建 Koa 实例
  // 错误处理中间件
  app.use(errorHandler()) // 在最外层，兜住所有错误
  // 日志中间件
  app.use(logger())
  // cors跨域处理
  app.use(cors()) // cors() 是函数调用 — 它返回中间件函数，Koa 的 app.use() 要的是函数
  app.use(bodyParser()) // 解析请求体
  // 注册路由
  app.use(healthRouter.routes())
  app.use(healthRouter.allowedMethods())    
  app.use(chatRouter.routes())
  app.use(chatRouter.allowedMethods())

  const PORT = parseInt(process.env.PORT ?? "3001", 10)
  return new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
      resolve()
    })
    server.on('error', reject) // 监听服务器错误事件, 并拒绝 Promise
    // 优雅关闭：收到终止信号时，停止接收新请求，等待已有请求完成
    function shutDown(signal: string) {
      console.log(`\n[Shutdown]收到${signal}，正在关闭服务`)
      server.close(() => {
        console.log('[Shutdown]服务已关闭,退出进程')
        process.exit(0)
      })
      // 超时兜底
      setTimeout(() => {
        console.error('[Shutdown]服务关闭超时,强制退出进程')
        process.exit(1)
      }, 5000);
    }
    // 监听终止信号
    process.on('SIGINT', () => shutDown('SIGINT')) // Ctrl+C
    process.on('SIGTERM', () => shutDown('SIGTERM')) // 部署系统终止
  })
}
