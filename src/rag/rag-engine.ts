import { EmbeddingClient } from "./embedding"
import { VectorStore } from "./vector-store"
import { join } from "path"
import { readFile } from "fs/promises"
import { chunkMarkdown } from "./chunker.js"

export class RAGEngine {
  private embed: EmbeddingClient
  private store: VectorStore
  private loaded: boolean = false // 是否已加载向量库
  constructor(embed: EmbeddingClient, store: VectorStore) {
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
    }
    this.loaded = true

  }
  // 加载纯文本
  async loadFromText(text: string, maxChunkSize?: number): Promise<void> {
    const embedding = await this.embed.embed(text)
    this.store.add(text, embedding, "纯文本")
  }
  // 检索
  async search(question: string, topK: number): Promise<string> {
   const queryVector = await this.embed.embed(question)
   const topKTexts = this.store.search(queryVector, topK)
    const result = topKTexts.map((r) => 
    `
    [来源：${r.metadata}]
    相关文本内容：${r.text}
    `
    ).join("\n")
    return result 
  }
}
