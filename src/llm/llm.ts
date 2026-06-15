// ============================================================
// Mock LLM — 根据预设关键词返回固定回复
// 让 agent 循环逻辑先跑通，下一阶段接入真实 LLM
// ============================================================

import type { LLM } from "../types/index.js";

/**
 * MockLLM 模拟 LLM 的 ReAct 输出格式：
 *
 * 需要工具时输出:
 *   Thought: 我需要查一下资料
 *   Action: tool_name({"key": "value"})
 *
 * 可以直接回答时输出:
 *   Thought: 我已经找到答案了
 *   Answer: 期末高数重点有...
 */
export class MockLLM implements LLM {
  async generate(_systemPrompt: string, userMessage: string): Promise<string> {
    // 检测上下文中是否已有 Observation（工具执行结果）
    // 有 → 返回最终答案；没有 → 返回 Thought + Action
    const hasObservation = userMessage.includes("Observation:");

    // 根据用户问题关键词判断意图
    const intent =
      userMessage.includes("重点") || userMessage.includes("章节")
        ? "keypoints"
        : userMessage.includes("模拟题") || userMessage.includes("题目")
          ? "practice"
          : userMessage.includes("计划") || userMessage.includes("安排")
            ? "plan"
            : "greeting";

    // === 第一轮：返回 Action（工具调用） ===
    if (!hasObservation) {
      switch (intent) {
        case "keypoints":
          return `Thought: 用户问考试重点，我需要查教材笔记。
Action: search_knowledge_base({"query": "期末重点章节"})`;
        case "practice":
          return `Thought: 用户想要模拟题，我需要生成一些练习题。
Action: generate_practice({"topic": "general", "count": "3"})`;
        case "plan":
          return `Thought: 用户需要复习计划，我查一下考试安排来制定计划。
Action: search_knowledge_base({"query": "考试安排"})`;
        default:
          return `Thought: 用户的问题可以直接回答，不需要调用工具。
Answer: 我是你的期末复习助手！我可以帮你：
1. 📖 查询各科重点章节
2. 📝 生成模拟题和解析
3. 📅 制定复习计划
4. ❓ 解答具体题目

你想先了解什么？`;
      }
    }

    // === 第二轮（有 Observation 结果）：返回 Answer ===
    switch (intent) {
      case "keypoints":
        return `Thought: 查到了结果，现在可以回答了。
Answer: 根据教材笔记，期末重点章节包括：函数与极限、导数与微分、不定积分、定积分、微分方程。建议优先复习定积分和微分方程，这些章节分值最高。`;
      case "practice":
        return `Thought: 生成完毕，呈现给用户。
Answer: 这里有三道模拟题：
1. 求极限 lim(x→0) (sin x)/x
2. 计算 ∫ x² dx
3. 求 y = e^x 的导数

需要答案和解析吗？`;
      case "plan":
        return `Thought: 还需要知道考试日期才能做计划。
Answer: 我查到相关资料了，但需要你告诉我：**考试日期是哪天？每天能投入多少小时复习？** 这样我可以帮你制定详细的突击计划。`;
      default:
        return `Thought: 信息已获取，可以回答了。
Answer: 我是你的期末复习助手！我可以帮你解答问题、生成模拟题、制定复习计划。你想先了解什么？`;
    }
  }
}
