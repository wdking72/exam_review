// sse工具函数
import { PassThrough } from "node:stream";
import type { Context } from "koa";

export function createSSEStream(ctx: Context) {
  const stream = new PassThrough() // 创建可写流

  // 设置响应头
  ctx.type = "text/event-stream";
  ctx.set("Cache-Control", "no-cache");
  ctx.set("Connection", "keep-alive");
  ctx.body = stream // 设置响应体为流

  return stream
}
// 用于发送流式事件
export function sendSSEEvent(stream: PassThrough, event: string, data: string) {
  stream.write(`event: ${event}\ndata: ${data}\n\n`)
}