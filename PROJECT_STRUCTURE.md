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
│   │   ├── ts                          # 核心类型（Agent、LLM、Tool）
│   │   └── rag.ts                      # RAG 共享类型（Chunk、KeywordResult、RerankResult、CacheData）
│   │
│   ├── utils/                          # 工具函数
│   │   └── rag-cache.ts                # Embedding 缓存读写（loadCache / saveCache）
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
│   │   └── rag-engine.ts               # RAG 引擎（串联完整流水线）
│   │
│   ├── tools/                          # Agent 工具
│   │   └── tools.ts                    # 工具注册中心 + 内置工具（知识库检索、模拟题生成）
│   │
│   ├── index.ts                        # 入口文件（CLI 参数解析 + 启动各模式）
│   └── test-rag.ts                     # RAG 测试脚本
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
| `utils/` | 与业务无关的工具函数 |
| `core/` | Agent 执行引擎，负责 LLM 调用 + 工具循环 |
| `llm/` | LLM 适配层，统一生成接口 |
| `rag/` | RAG 流水线：分块 → 向量化 → 检索 → 重排 |
| `tools/` | Agent 可用工具（可扩展） |

## 数据流

```
用户输入
  → index.ts（CLI / 交互式）
    → Agent（core/agent.ts）
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
- **加工具函数** → 放在 `utils/` 下
- **加 Agent** → 放在 `core/` 下
- **加 RAG 组件** → 放在 `rag/` 下
