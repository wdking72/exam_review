import { OpenAI } from 'openai'
// 向量嵌入客户端,用于将文本转换为向量组
export class EmbeddingClient {
  private client: OpenAI
  private model: string
  constructor(baseUrl: string, apiKey: string, model?: string) {
    // 用openAI SDK创建client
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    })
    this.model = model || 'text-embedding-3-small'
  }
  // 用openAI SDK创建向量组
  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      input: text,
      model: this.model,
    })
    // 返回向量组
    return res.data[0].embedding
  }
  async embedMany(texts: string[]): Promise<number[][]> {
    const res = await this.client.embeddings.create({
      input: texts,
      model: this.model,
    })
    // 返回向量组
    return res.data.map((item) => item.embedding)
  }
}
