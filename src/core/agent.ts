// ============================================================
// Agent 核心 — ReAct 循环
//
// TODO: 你需要实现 run 方法中的 ReAct 循环逻辑
// ============================================================

import type { AgentConfig, AgentResult, AgentStep } from "../types/index.js";

export class Agent {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * 执行 ReAct 循环
   *
   * 你需要实现以下逻辑：
   *
   * 1. 调用 llm.generate() 传入用户问题
   * 2. 解析 LLM 输出，判断是 Thought+Action 还是直接 Answer
   * 3. 如果是 Action:
   *    a. 解析工具名称和参数
   *    b. 在 this.config.tools 中找到对应工具
   *    c. 调用 tool.execute()
   *    d. 把工具结果拼回 prompt，再次调用 llm.generate()
   * 4. 如果是 Answer:
   *    a. 提取最终答案
   *    b. 返回 AgentResult
   * 5. 超过 maxIterations 步就强制终止
   *
   * LLM 输出格式约定:
   *   Action: tool_name({"key": "value"})
   *   Answer: 最终回答
   */
  async run(userMessage: string): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    const { systemPrompt, maxIterations, llm } = this.config;

    // 构建初始对话上下文
    let context = `用户问题: ${userMessage}\n\n`;

    for (let i = 0; i < maxIterations; i++) {
      // 调用 LLM
      const response = await llm.generate(systemPrompt, context);

      // ===== TODO: 从这里开始实现 ReAct 循环逻辑 =====

      // 1. 解析 response，提取 Thought / Action / Answer
      const thoughtMatch = response.match(/Thought:\s*([\s\S]*?)(?=Action:|Answer:|$)/);
      const actionMatch = response.match(/Action:\s*(\w+)\((\{.*?\})\)/);
      const answerMatch = response.match(/Answer:\s*([\s\S]+)/);

      const thought = thoughtMatch ? thoughtMatch[1].trim() : undefined
      // 2. 如果包含 Action:
      //    - 解析出工具名称和参数
      //    - 找到对应的工具执行
      //    - 把结果追加到 context
      //    - 继续循环
      if (actionMatch) {
        const toolName = actionMatch[1]
        const toolArgsRaw = actionMatch[2]
        const toolArgs: Record<string, string> = JSON.parse(toolArgsRaw) ?? {}

        // 找到对应的工具
        const toolResult = await this.config.tools.execute(toolName, toolArgs)
        steps.push({thought, toolCall: { name: toolName,  arguments: toolArgs}, toolResult})
        context += `\nAction: ${toolName}(${toolArgsRaw})\nObservation: ${toolResult}`
        continue
      }

      // 3. 如果包含 Answer:
      //    - 提取最终答案
      //    - 返回结果
      if (answerMatch) {
        const answer =  answerMatch[1].trim() 
        steps.push({thought, answer})
        return  {
          answer,
          steps
        }
      }
      // ===== 临时占位，让项目能跑通 =====
      steps.push({ thought: `Iteration ${i + 1}: ${response.slice(0, 100)}...` });
      context += `\n${response}\n`;
    }

    return {
      answer: "Reached max iterations without final answer.",
      steps,
    };
  }

  /** 工具列表（给 UI 用） */
  getTools() {
    return this.config.tools.list().map(tool => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}
