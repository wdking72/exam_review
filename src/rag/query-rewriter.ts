import { LLM } from "../types";

/**
 * 查询改写器
 *
 * 用 LLM 把用户问题改写得更适合向量检索：
 * - 代词 → 具体名词（"这个怎么算" → "极限的计算方法"）
 * - 补全省略的上下文
 * - 去掉口语化表达
 */
export class QueryRewriter {
  constructor(private llm: LLM) {}

  async rewrite(question: string): Promise<string> {
    const rewritten = await this.llm.generate(
      `你是一个搜索查询改写助手。把用户的问题改写成一段清晰、自包含的查询文本，适合用于向量检索。

      规则：
      1. 将代词替换为具体名词
      2. 补全省略的上下文
      3. 保留核心关键词
      4. 只返回改写后的文本，不要加任何解释`,
      question,
    )

    // 兜底：如果 LLM 返回空，用原问题
    return rewritten?.trim() || question
  }
}