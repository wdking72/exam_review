// 向量数据库，存储向量组 + 按相似度检索
// 向量文档接口
export interface VectorDoc {
  id: string
  text: string
  vector: number[]
  metadata?: string
}
export class VectorStore {
  private docs: VectorDoc[] = []
 // 余弦相似度
 cosineSimilarity(a: number[], b: number[]): number {
  // 除0保护
  if (a.every((item) => item === 0) || b.every((item) => item === 0)) {
    return 0
  }
  // 计算余弦相似度
  const dotProduct = a.reduce((acc, cur, index) => acc + cur * b[index], 0) // 向量a和b的点积
  const aMag = Math.sqrt(a.reduce((acc, cur) => acc + cur * cur, 0)) // 向量a的模长
  const bMag = Math.sqrt(b.reduce((acc, cur) => acc + cur * cur, 0)) // 向量b的模长
  return dotProduct / (aMag * bMag)
 }
 // 添加文档
 add(text: string, vector: number[], metadata?: string) {
  // 生成随机id
  const id = Math.random().toString(36).substring(2, 10)
  this.docs.push({ id, text, vector, metadata })
 }
 // 检索： 问题向量 → 相似度topK的文档
 search(queryVector: number[], topK: number): {text: string, score: number, metadata?: string}[] {
  // 计算每个文档的相似度
  const scores = this.docs.map((doc) => ({
    text: doc.text,
    score: this.cosineSimilarity(queryVector, doc.vector),
    metadata: doc.metadata,
  }))
  // 按相似度排序
  scores.sort((a, b) => b.score - a.score) // 从高到低排序
  // 取topK个
  return scores.slice(0, topK)
}
}
