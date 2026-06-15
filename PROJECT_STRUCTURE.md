# 项目文件结构

```
exam-cram-agent/
├── knowledge/                          # 知识库文件（markdown 格式教材）
│   └── 高等数学（上）-期末速成.md
│
├── .rag-cache/                         # Embedding 缓存（自动生成，不入 git）
│   └── *.json                          # 按文件 mtime 哈希命名的缓存
│
├── src/
│   ├── types/                          # 类型定义
│   │   ├── index.ts                    # 核心类型（Agent、LLM、Tool）
│   │   └── rag.ts                      # RAG 共享类型（Chunk、KeywordResult、RerankResult、CacheData）
│   │
│   ├── core/                           # Agent 核心
│   │   ├── agent.ts                    # ReAct Agent（Thought/Action/Observation 循环）
│   │   ├── agent-native.ts             # Native Tool Use Agent（tools 参数模式）
│   │   └── memory.ts                   # 对话记忆管理（Sliding Window / Summarization）
│   │
│   ├── llm/                            # LLM 接口与实现
│   │   ├── llm.ts                      # LLM 接口定义 + MockLLM（开发调试用）
│   │   ├── llm-claude.ts               # Claude API 实现
│   │   └── llm-openai.ts               # OpenAI 兼容 API 实现（硅基流动）
│   │
│   ├── rag/                            # RAG 检索增强生成
│   │   ├── chunker.ts                  # Markdown 文档分块（标题切分 + 段落合并 + Overlap）
│   │   ├── embedding.ts                # Embedding API 客户端（文本 → 向量）
│   │   ├── vector-store.ts             # 内存向量库（余弦相似度检索）
│   │   ├── keyword-search.ts           # BM25 关键词检索（倒排索引）
│   │   ├── reranker.ts                 # 重排序器（融合向量分 + 关键词分）
│   │   ├── query-rewriter.ts           # 查询改写器（LLM 改写用户问题）
│   │   ├── rag-engine.ts               # RAG 引擎（串联完整流水线）
│   │   └── rag-cache.ts                # Embedding 缓存读写（loadCache / saveCache）
│   │
│   ├── tools/                          # Agent 工具
│   │   └── tools.ts                    # 工具注册中心 + 内置工具（知识库检索、模拟题生成）
│   │
│   ├── server/                         # HTTP 服务（待开发）
│   │
│   ├── scripts/                        # 独立脚本
│   │   └── test-rag.ts                 # RAG 测试脚本
│   │
│   └── index.ts                        # 入口文件（CLI 参数解析 + 启动各模式）
│
├── docs/                               # 文档
│   └── frontend-plan.md                # 前端 + HTTP 服务实施计划
│
├── .learn/                             # 学习进度（learn-it skill）
├── .claude/                            # Claude 配置
├── PROJECT_STRUCTURE.md                # 本文件
├── package.json
└── tsconfig.json
```

## 模块职责

| 模块 | 职责 |
|------|------|
| `types/` | 共享类型定义，减少跨文件循环依赖 |
| `core/` | Agent 执行引擎，负责 LLM 调用 + 工具循环 |
| `llm/` | LLM 适配层，统一生成接口 |
| `rag/` | RAG 流水线：分块 → 向量化 → 检索 → 重排 + 缓存 |
| `tools/` | Agent 可用工具（可扩展） |
| `server/` | HTTP 服务层（Koa 路由 + SSE） |
| `scripts/` | 独立脚本（测试、数据准备等） |

## 数据流

```
用户输入
  → index.ts（CLI / 交互式 / HTTP 服务）
    → Agent（core/agent.ts 或 core/agent-native.ts）
      → LLM（llm/）
      → Tool（tools/）
        → RAGEngine（rag/rag-engine.ts）
          → QueryRewriter（改写查询）
          → EmbeddingClient（向量化）
          → VectorStore.search（语义检索）
          → KeywordSearch.search（关键词检索）
          → Reranker.rerank（融合排序）
```

## 新增文件指引

- **加类型** → 放在 `types/` 下，按模块分文件
- **加工具函数** → 放在所属模块内
- **加 Agent** → 放在 `core/` 下
- **加 RAG 组件** → 放在 `rag/` 下
- **加 HTTP 路由** → 放在 `server/routes/` 下
- **加脚本** → 放在 `scripts/` 下
