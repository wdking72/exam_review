import OpenAI from "openai";
import { MemoryManager } from "./memory.js";
import type { ToolRegistryType, LLM } from "../types.js";

// ============================================================
// 给 MemoryManager 用的 LLM 包装器（用于 summarization 压缩）
// ============================================================
class SummarizerLLM implements LLM {
  private client: OpenAI;
  private model: string;
  constructor(client: OpenAI, model: string) {
    this.client = client;
    this.model = model;
  }
  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 512,
    });
    return res.choices[0]?.message?.content || "";
  }
}

// ============================================================
// 工具格式转换（复用）
// ============================================================
function buildTools(registry: ToolRegistryType) {
  return registry.list().map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  }));
}

// ============================================================
// NativeToolAgent
// ============================================================
export class NativeToolAgent {
  private client: OpenAI;
  private model: string;
  private registry: ToolRegistryType;
  private memory: MemoryManager;
  private summarizer: SummarizerLLM;
  private systemPrompt = "";

  constructor(config: {
    baseURL: string;
    apiKey: string;
    model: string;
    registry: ToolRegistryType;
    memory?: MemoryManager;
  }) {
    this.client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    this.model = config.model;
    this.registry = config.registry;
    this.memory = config.memory ?? new MemoryManager();
    this.summarizer = new SummarizerLLM(this.client, this.model);
  }

  /** 初始化（设置 system prompt，只在首次调用时生效） */
  init(systemPrompt: string) {
    if (this.systemPrompt) return;
    this.systemPrompt = systemPrompt;
    this.memory.addSystem(systemPrompt);
  }

  // ============================================================
  // 单轮（每次重置 memory）
  // ============================================================
  async run(systemPrompt: string, userMessage: string) {
    this.systemPrompt = systemPrompt;
    this.memory = new MemoryManager();
    this.memory.addSystem(systemPrompt);
    return await this.chat(userMessage);
  }

  // ============================================================
  // 多轮对话（保留 memory，可连续调用）
  // ============================================================
  async chat(userMessage: string) {
    const tools = buildTools(this.registry);
    this.memory.addUser(userMessage);

    const steps: Array<{
      toolCall?: { name: string; arguments: Record<string, string> };
      toolResult?: string;
      answer?: string;
    }> = [];

    for (let i = 0; i < 5; i++) {
      const messages = this.memory.getMessages();

      const res = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools,
        max_tokens: 1024,
      });

      const msg = res.choices[0].message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const tc = msg.tool_calls[0];
        if (tc.type !== "function") continue;
        const args = JSON.parse(tc.function.arguments);

        const result = await this.registry.execute(tc.function.name, args);

        steps.push({
          toolCall: { name: tc.function.name, arguments: args },
          toolResult: result,
        });

        this.memory.addAssistant(msg.content || "", msg.tool_calls);
        this.memory.addTool(result, tc.id);
        await this.memory.compressIfNeeded(this.summarizer, this.systemPrompt);
      } else {
        steps.push({ answer: msg.content || "" });
        this.memory.addAssistant(msg.content || "");
        return { answer: msg.content || "", steps };
      }
    }

    return { answer: "超出最大迭代次数", steps };
  }

  // ============================================================
  // 多轮 + 流式输出
  //
  // onToken(data) 回调:
  //   data.type === "text"  → 普通文本 token
  //   data.type === "tool"  → 工具调用信息
  //   data.type === "done"  → 本轮全部完成
  // ============================================================
  async streamChat(
    userMessage: string,
    onToken: (data: { type: "text" | "tool" | "done"; content: string }) => void
  ) {
    const tools = buildTools(this.registry);
    this.memory.addUser(userMessage);

    for (let i = 0; i < 5; i++) {
      const messages = this.memory.getMessages();

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools,
        stream: true,
        max_tokens: 1024,
      });

      // 累加器：按 tool_call index 分组
      let content = "";
      const toolCallAcc: Record<
        number,
        { id: string; name: string; arguments: string }
      > = {};
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // finish_reason: 只取第一次非 null 的值
        //（末尾空 chunk 会用 null 覆盖，需跳过）
        if (finishReason === null) {
          finishReason = chunk.choices[0]?.finish_reason ?? null;
        }

        // 文本 token → 立即回调
        if (delta?.content) {
          content += delta.content;
          onToken({ type: "text", content: delta.content });
        }

        // tool call delta → 按 index 累加
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallAcc[idx]) {
              toolCallAcc[idx] = { id: "", name: "", arguments: "" };
            }
            if (tc.id) toolCallAcc[idx].id += tc.id;
            if (tc.function?.name) toolCallAcc[idx].name += tc.function.name;
            if (tc.function?.arguments)
              toolCallAcc[idx].arguments += tc.function.arguments;
          }
        }
      }

      // 判断是否有 tool call
      const toolCalls = Object.values(toolCallAcc);
      if (toolCalls.length > 0 && finishReason === "tool_calls") {
        // 构造 OpenAI 格式的 tool_calls
        const openaiToolCalls = toolCalls.map((t) => ({
          id: t.id,
          type: "function" as const,
          function: { name: t.name, arguments: t.arguments },
        }));

        // assistant 消息只加一次（不是在每个 tool 的循环里）
        this.memory.addAssistant(content, openaiToolCalls);

        // 逐个执行 tool
        for (const tc of toolCalls) {
          const args = JSON.parse(tc.arguments);
          const result = await this.registry.execute(tc.name, args);

          onToken({
            type: "tool",
            content: `\n  tool: ${tc.name}(${JSON.stringify(args)})\n  result: ${result.slice(0, 100)}...\n`,
          });

          this.memory.addTool(result, tc.id);
        }

        // 所有 tool 执行完后统一压缩一次
        await this.memory.compressIfNeeded(this.summarizer, this.systemPrompt);
      } else {
        // 没有 tool call → 最终回答
        this.memory.addAssistant(content);
        onToken({ type: "done", content });
        return;
      }
    }
  }

  /** 暴露 memory stats */
  getMemoryStats() {
    return this.memory.getStats();
  }

  /** 重置对话 */
  resetMemory() {
    this.memory = new MemoryManager();
  }
}
