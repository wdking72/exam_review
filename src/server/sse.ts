

import type { Context } from "koa";
import type { ServerResponse } from "node:http";

/**
 * 初始化 SSE 流：设置响应头并立即发送
 * @returns ctx.res，后续直接往上面 write
 */
export function createSSEStream(ctx: Context): ServerResponse {
  // 设置 SSE 必要的响应头
  ctx.type = "text/event-stream";
  ctx.set("Cache-Control", "no-cache");
  ctx.set("Connection", "keep-alive");
  // 告诉 nginx 等反向代理不要缓冲响应
  ctx.set("X-Accel-Buffering", "no");

  // 【关键】显式设置 HTTP 200，否则 Koa 默认的 404 状态会被 flush 出去，
  // 导致浏览器/前端 fetch 认为请求失败（虽然响应体仍在流式推送）。
  ctx.status = 200;

  // 【关键】立即发送响应头，不等中间件结束
  // 这样客户端能尽早建立 SSE 连接
  ctx.res.flushHeaders();

  return ctx.res;
}

/**
 * 发送一条 SSE 事件
 * 直接写入 ctx.res，数据立即到达客户端
 *
 * 【注意】这里的 res.write() 只是把数据交给 Node.js 的 HTTP 层。
 *   在没有压缩中间件的情况下，chunked 编码会尽快把数据发出去，
 *   但不保证每个 write() 都对应一个 TCP 包。如果后续发现前端
 *   仍然整段出现，可尝试在此行后加 (res as any).flush?.()（需
 *   配合压缩中间件）或设置 res.socket?.setNoDelay(true)。
 */
export function sendSSEEvent(res: ServerResponse, event: string, data: string) {
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}