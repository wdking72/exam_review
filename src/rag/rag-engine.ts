import { readFile } from "node:fs/promises"
import { EmbeddingClient } from "./embedding.js"
import { VectorStore } from "./vector-store.js"
import { chunkMarkdown } from "./chunker.js"
import { KeywordSearch } from "./keyword-search.js"
import { QueryRewriter } from "./query-rewriter.js"
import { rerank } from "./reranker.js"
import { loadCache, saveCache } from "./rag-cache.js"
import type { RerankResult } from "../types/rag.js"

export class RAGEngine {
  private loaded: boolean = false
  constructor(
    private embed: EmbeddingClient,
    private store: VectorStore,
    private keywordSearch?: KeywordSearch,
    private queryRewriter?: QueryRewriter,
  ) {}
  // 从文件加载知识库
  async loadFromFile(filePath: string, maxChunkSize?: number): Promise<void> {
    const md = await readFile(filePath, "utf-8")
    const chunks = chunkMarkdown(md, maxChunkSize)
    const texts = chunks.map((c) => c.text)
    const headings = chunks.map((c) => c.heading)

    // 尝试从缓存加载 embedding，免去 API 调用
    const cached = await loadCache(filePath)
    let embeddings: number[][]

    if (cached && cached.texts.length === texts.length) {
      // 缓存命中且 chunk 数量一致，直接复用
      embeddings = cached.embeddings
    } else {
      // 没有缓存或文件已变，调 API 计算
      embeddings = await this.embed.embedMany(texts)
      // 后台写入缓存，不阻塞返回
      saveCache(filePath, { texts, embeddings, headings })
    }

    // 分别存入向量库和关键词索引
    for (let i = 0; i < texts.length; i++) {
      this.store.add(texts[i], embeddings[i], headings[i])
      this.keywordSearch?.add(`chunk_${i}`, texts[i], headings[i])
    }
    this.loaded = true
  }
  // 加载纯文本
  async loadFromText(text: string, maxChunkSize?: number): Promise<void> {
    const embedding = await this.embed.embed(text)
    this.store.add(text, embedding, "纯文本")
    this.keywordSearch?.add(`pure_text`, text, "纯文本")
    this.loaded = true
    
  }
  // 检索
  async search(question: string, topK: number): Promise<string> {
    // 查询参数改写
    const query = this.queryRewriter ? await this.queryRewriter.rewrite(question) : question
    const queryVector = await this.embed.embed(query)  
    // 检索向量
    const vectorResults = this.store.search(queryVector, topK * 3) // 增加检索数量，因为关键词检索会减少
    // 检索关键词
    const keywordResults = this.keywordSearch?.search(query, topK * 3) || []
    // 融合重排
    let topKTexts: RerankResult[] = []
    if (keywordResults.length > 0) {
      const results = rerank({ vectorResults, keywordResults, topK })
      topKTexts = results.slice(0, topK)
    } else {
      topKTexts = vectorResults.slice(0, topK)
    }

    const result = topKTexts.map((r) => 
    `
    [来源：${r.metadata}]
    相关文本内容：${r.text}
    `
    ).join("\n")
    return result 
  }
}
