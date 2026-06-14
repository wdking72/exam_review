interface KeywordResult {
  text: string
  score: number
  metadata?: string
}
// BM25 关键词检索
export class KeywordSearch {
  private invertedIndex = new Map<string, Map<number, number>>()
  private docs: { id: string; text: string; metadata?: string }[] = []
  private docCount: number = 0
  private avgDocLen: number = 0

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-zA-Z0-9一-鿿]+/)
      .filter((w) => w.length > 1)
  }
  add(id: string, text: string, metadata?: string) {
    // 分词并存储
    this.docs.push({ id, text, metadata })
    const docIndex = this.docCount
    const tokens = this.tokenize(text)
    const termCounts = new Map<string, number>()
    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1)
    }
    // 更新倒排索引
    for (const [token, count] of termCounts) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Map<number, number>())
      }
      this.invertedIndex.get(token)!.set(docIndex, count)
    }
    this.docCount++
    this.avgDocLen = 
    this.docCount === 1 
    ? tokens.length
    : (this.avgDocLen * (this.docCount - 1) + tokens.length) / this.docCount
  }
  /**
   * BM25 检索
   *
   * 对查询分词后，逐个 term 查倒排索引，累加每个文档的 BM25 分数。
   * 最终按分数降序返回 topK 个结果。
   */
  search(query: string, topK: number): KeywordResult[] {
    const queryTokens = this.tokenize(query)
    if (queryTokens.length === 0 || this.docCount === 0) return []

    const scores = new Array(this.docCount).fill(0)
    const k1 = 1.5  // TF 饱和度控制：越大 TF 影响越大
    const b = 0.75   // 长度归一化强度：0=不启用, 1=完全归一化

    for (const qToken of queryTokens) {
      const postingList = this.invertedIndex.get(qToken)
      if (!postingList) continue

      // IDF: 稀有词权重更高，常见词权重更低
      const df = postingList.size
      const idf = Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1)

      for (const [docIndex, tf] of postingList) {
        const docLen = this.tokenize(this.docs[docIndex].text).length
        // TF 归一化：抑制长文档的 TF 优势
        const tfNorm =
          (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / this.avgDocLen)))
        scores[docIndex] += idf * tfNorm
      }
    }

    // 收集有分数的结果
    const results: KeywordResult[] = []
    for (let i = 0; i < this.docCount; i++) {
      if (scores[i] > 0) {
        results.push({
          text: this.docs[i].text,
          score: scores[i],
          metadata: this.docs[i].metadata,
        })
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }
}