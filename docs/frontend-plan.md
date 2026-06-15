# Exam Cram Agent — 前端 + HTTP 服务实施计划

## 一、架构概览

```
用户浏览器 (Vue 3 + Tailwind)
      │ POST /api/chat/stream (SSE)
      ▼
Koa 服务器 (src/server/)
      │
      ├── NativeToolAgent (src/core/agent-native.ts)
      ├── RAGEngine (src/rag/rag-engine.ts)
      └── ToolRegistry (src/tools/tools.ts)
```

## 二、技术栈

### 后端（现有 + 新增）
- **Koa** — HTTP 框架
- **@koa/router** — 路由
- **koa-cors** — 跨域（开发环境）
- SSE 原生实现（无需额外库）

### 前端（全新）
- **Vue 3** + Composition API + `<script setup>`
- **Vite** — 构建工具
- **Vue Router** — 路由
- **Tailwind CSS** — 样式
- 原生 `fetch` — SSE 消费

## 三、项目结构（新增/改动部分）

```
exam-cram-agent/
├── src/
│   ├── core/                    ← 不变
│   ├── llm/                     ← 不变
│   ├── rag/                     ← + rag-cache.ts（从 utils/ 移入）
│   ├── tools/                   ← 不变
│   ├── types/                   ← + index.ts（原 types.ts 移入）
│   ├── scripts/                 ★ 新增 ★
│   │   └── test-rag.ts          ★ 从根目录移入 ★
│   │
│   ├── server/                  ★ 新增 ★
│   │   ├── index.ts             Koa 启动入口
│   │   ├── routes/
│   │   │   ├── chat.ts          POST /api/chat/stream（SSE）
│   │   │   └── health.ts        GET /api/health
│   │   └── sse.ts               SSE 工具函数
│   │
│   └── index.ts                 改造：--server 参数启动 Koa，默认 CLI
│
├── frontend/                    ★ 新增 ★
│   ├── index.html
│   ├── vite.config.ts           proxy /api → localhost:3001
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   ├── src/
│   │   ├── main.ts              应用入口
│   │   ├── App.vue              根组件
│   │   ├── router/
│   │   │   └── index.ts         路由
│   │   ├── views/
│   │   │   └── ChatView.vue     对话页面
│   │   ├── components/
│   │   │   ├── ChatInput.vue    输入框
│   │   │   ├── ChatMessage.vue  单条消息（区分用户/助手/工具调用）
│   │   │   └── Sidebar.vue      侧边栏（对话列表，后续）
│   │   ├── composables/
│   │   │   └── useChat.ts       SSE 流式对话逻辑
│   │   └── assets/
│   │       └── style.css        全局样式
│   └── public/
│
├── package.json                 追加 script + koa 依赖
└── docs/
    └── frontend-plan.md         本文件
```

## 四、API 设计

### POST /api/chat/stream（SSE）

**Request** (JSON body):
```json
{
  "message": "高数期末考试重点是什么？",
  "useRag": true
}
```

**Response** (SSE stream):
```
event: token
data: {"type":"text","content":"正在"}

event: token
data: {"type":"text","content":"思考"}

event: token
data: {"type":"tool","content":"调用 search_knowledge_base..."}

event: token
data: {"type":"text","content":"根据教材笔记，重点是定积分和微分方程"}

event: done
data: {"type":"done","content":""}
```

前端用 `fetch` + `ReadableStream` 消费（`EventSource` 不支持 POST）。

### GET /api/health

```json
{ "status": "ok", "ragLoaded": true }
```

## 五、前后端交互细节

1. **SSE 格式**：每行 `event: xxx\ndata: xxx\n\n`，Koa 设置 `content-type: text/event-stream`
2. **流式渲染**：前端逐 token 追加到当前消息，工具调用显示特殊格式（灰色代码块或加载指示器）
3. **错误处理**：网络断开时显示重试按钮；后端异常时推送 `event: error`

## 六、实施步骤

### Phase 1 — 后端 Koa 服务
| 步骤 | 内容 |
|------|------|
| 1.1 | 安装 koa / @koa/router / koa-cors |
| 1.2 | 新建 `src/server/sse.ts` — SSE 工具函数 |
| 1.3 | 新建 `src/server/routes/health.ts` — 健康检查 |
| 1.4 | 新建 `src/server/routes/chat.ts` — SSE 对话路由 |
| 1.5 | 新建 `src/server/index.ts` — 启动 Koa |
| 1.6 | 改造 `src/index.ts` — 支持 `--server` 参数 |
| 1.7 | `curl` 验证 SSE 流能正常工作 |

### Phase 2 — 前端 Vue 3
| 步骤 | 内容 |
|------|------|
| 2.1 | `npm create vite@latest frontend -- --template vue-ts` |
| 2.2 | 安装 Tailwind CSS + 配置 |
| 2.3 | 配置 `vite.config.ts` proxy |
| 2.4 | 实现 `useChat` composable — SSE 消费逻辑 |
| 2.5 | 实现 `ChatInput.vue` — 输入框组件 |
| 2.6 | 实现 `ChatMessage.vue` — 消息气泡组件 |
| 2.7 | 实现 `Sidebar.vue` — 侧边栏 |
| 2.8 | 组装 `ChatView.vue` — 完整对话页面 |

## 七、根 package.json 改动

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:front\"",
    "dev:server": "tsx src/index.ts --server",
    "dev:front": "cd frontend && npm run dev"
  },
  "dependencies": {
    "koa": "^2.15.0",
    "@koa/router": "^12.0.0",
    "koa-cors": "^0.0.16",
    "concurrently": "^8.2.0"
  }
}
```
