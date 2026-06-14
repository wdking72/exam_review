/**
 * 重排序器
 *
 * 将向量检索和 BM25 关键词检索的结果融合重排。
 *
 * 思路：
 * 1. 两边分数各自做最大值归一化（映射到 [0,1]），消除量纲差异
 *    - 向量分范围 ~[0,1]，BM25 分范围 ~[0,∞)，不能直接比较
 * 2. 以 text 为 key 合并两边结果
 * 3. finalScore = alpha × vecNorm + (1-alpha) × kwNorm
 */

export interface RerankResult {
  text: string
  score: number
  metadata?: string
}

interface RerankParams {
  vectorResults: RerankResult[]
  keywordResults: RerankResult[]
  topK: number
  /** 语义权重 [0,1]，越大越偏向向量检索，默认 0.5 */
  alpha?: number
}

/**
 * 融合重排：合并向量 + 关键词结果，按综合分数排序
 */
export function rerank(params: RerankParams): RerankResult[] {
  const { vectorResults, keywordResults, topK, alpha = 0.5 } = params

  // 边界情况：如果有一边没有结果，直接返回另一边
  if (vectorResults.length === 0) return keywordResults.slice(0, topK)
  if (keywordResults.length === 0) return vectorResults.slice(0, topK)

  // 1. 找两边最大值用于归一化
  const maxVec = Math.max(...vectorResults.map((r) => r.score), 0.0001)
  const maxKw = Math.max(...keywordResults.map((r) => r.score), 0.0001)

  // 2. 用 Map 以 text 为 key 聚合两边分数
  const scoreMap = new Map<string, { normVec: number; normKw: number; metadata?: string }>()

  for (const r of vectorResults) {
    scoreMap.set(r.text, {
      normVec: r.score / maxVec,
      normKw: 0,
      metadata: r.metadata,
    })
  }

  for (const r of keywordResults) {
    const existing = scoreMap.get(r.text)
    if (existing) {
      existing.normKw = r.score / maxKw
    } else {
      scoreMap.set(r.text, {
        normVec: 0,
        normKw: r.score / maxKw,
        metadata: r.metadata,
      })
    }
  }

  // 3. 计算最终分数并排序
  const results: RerankResult[] = []
  for (const [text, { normVec, normKw, metadata }] of scoreMap) {
    const score = alpha * normVec + (1 - alpha) * normKw
    results.push({ text, score, metadata })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, topK)
}
