import { EmbeddingClient } from "./embedding"
import { VectorStore } from "./vector-store"
import { join } from "path"
import { readFile } from "fs/promises"
import { chunkMarkdown } from "./chunker.js"
import { KeywordSearch } from "./keyword-search.js"
import { QueryRewriter } from "./query-rewriter.js"
import { rerank } from "./reranker.js"
import type { RerankResult } from "./reranker.js"


export class RAGEngine {
  private loaded: boolean = false // 是否已加载向量库
  constructor(
    private embed: EmbeddingClient,                                                                                     
    private store: VectorStore,                                                                                         
    private keywordSearch?: KeywordSearch,                                                                              
    private queryRewriter?: QueryRewriter,
  ) {
    this.embed = embed
    this.store = store
  }
  // 从文件加载知识库
  async loadFromFile(filePath: string, maxChunkSize?: number): Promise<void> {
    // 读取知识库
    const md = await readFile(filePath, 'utf-8')
    // 分块
    const chunks = chunkMarkdown(md, maxChunkSize)
    const texts = chunks.map((c) => c.text)
    // 向量化
    const embeddings = await this.embed.embedMany(texts)
    // 存储向量
    for (let i = 0; i < texts.length; i++) {
      this.store.add(texts[i], embeddings[i], chunks[i].heading)
      this.keywordSearch?.add(`chunk_${i}`, texts[i], chunks[i].heading)
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
