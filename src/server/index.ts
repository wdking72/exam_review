import Koa from 'koa'
import { bodyParser } from '@koa/bodyparser'

const app = new Koa() // 创建 Koa 实例
app.use(bodyParser()) // 解析请求体

app.listen(3000)
console.log('Server is running on port 3000')
