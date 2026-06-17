# Debug Session: sse-streaming-buffer

- **Status**: [FIXED]
- **Issue**: 前端 LLM 回答不是逐字流式打印，而是等全部响应完成后一次性出现。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-sse-streaming-buffer.ndjson

## Reproduction Steps

1. 启动后端：`npm run dev:server`（或 `tsx src/index.ts --server`）
2. 启动前端：`npm run dev:front`
3. 在浏览器输入框发送任意问题，例如“你好”
4. 观察助手消息：期望逐字出现；实际整段一起出现

## Hypotheses & Verification

| ID  | Hypothesis                                                                          | Likelihood    | Effort | Evidence                                                                                                       |
| --- | ----------------------------------------------------------------------------------- | ------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| A   | 后端 `sendSSEEvent()` 只 `write()` 不 `flush()`，数据积压在 Node.js / OS TCP 缓冲区 | **Rejected**  | Low    | 后端代码直接写 ctx.res；curl 直连后端得到 86 个 chunk，说明后端正常流式发送                                    |
| B   | Vite 开发服务器代理缓冲了 SSE 响应                                                  | **Confirmed** | Low    | 浏览器/前端通过 `/api/chat/stream` 只收到 1 个 3596B 的 raw chunk；curl 直连 `localhost:3001` 得到 86 个 chunk |
| C   | LLM 上游（OpenAI SDK / 模型服务）本身没有真正流式返回                               | **Rejected**  | Med    | 调试日志显示 `agent-native.ts` 的 onToken 是逐 token 触发的，时间戳间隔几 ms 到几十 ms                         |
| D   | 前端 Vue 响应式更新有批次合并，导致视觉上“一次性出现”                               | **Rejected**  | Low    | 前端收到的是单一大 chunk，说明问题在到达前端之前就已经被缓冲                                                   |

## Root Cause

1. **Vite 开发服务器内置的 http-proxy 在转发 SSE 响应时缓冲了整个响应**，等后端请求完全结束后才一次性推送给浏览器。
2. 后端 `createSSEStream()` 没有显式设置 `ctx.status = 200`，导致浏览器/前端 fetch 收到 404（虽然响应体仍在流式推送）。

## Fix

- `frontend/src/composables/useChat.ts`：开发环境直接请求 `http://127.0.0.1:3001/api/chat/stream`，绕过 Vite 代理；生产环境仍使用 `/api/chat/stream`。
- `frontend/vite.config.ts`：代理目标改为 `http://127.0.0.1:3001`，避免 IPv6 解析问题。
- `src/server/sse.ts`：`createSSEStream()` 中显式设置 `ctx.status = 200` 再 `flushHeaders()`。

## Verification

- 修复前：前端通过 Vite 代理收到 1 个 3596B 大 chunk，视觉上整段出现。
- 修复后：前端直连后端，收到 60+ 个 chunk，HTTP 200，浏览器中逐字流式输出。
- 用户已确认：刷新浏览器后助手消息逐字流式输出。

## 用户问题补充

- **风险**：开发环境直连后端需要后端开启 CORS（已开启），且假设后端跑在 127.0.0.1:3001；生产环境仍走相对路径，无额外风险。
- **Vite proxy 是否还有用**：当前 `/api` 代理在开发环境下仍可用于除 SSE 外的其他 API；SSE 已绕过代理。如果项目只有 SSE 这一个 `/api` 接口，则该代理当前可视为备用/无用。
