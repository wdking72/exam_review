// ============================================================
// RAG 系统共享类型定义
// ============================================================

/** 文档分块结果 */
export interface Chunk {
  id: string
  text: string
  heading: string
  index: number
}

/** BM25 关键词检索结果 */
export interface KeywordResult {
  text: string
  score: number
  metadata?: string
}

/** 重排序结果 */
export interface RerankResult {
  text: string
  score: number
  metadata?: string
}

/** 重排序器参数 */
export interface RerankParams {
  vectorResults: RerankResult[]
  keywordResults: RerankResult[]
  topK: number
  alpha?: number
}

/** Embedding 缓存数据 */
export interface CacheData {
  texts: string[]
  embeddings: number[][]
  headings: string[]
}
