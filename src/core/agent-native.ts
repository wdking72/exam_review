import OpenAI from "openai";
import { MemoryManager } from "./memory.js";
import type { ToolRegistryType, LLM } from "../types/index.js";

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
// 工具消息格式化（让 UI 更友好）
// ============================================================
function formatToolStart(name: string, args: Record<string, string>): string {
  if (name === "search_knowledge_base") {
    return `正在搜索「${args.query || ""}」…`;
  }
  if (name === "generate_practice") {
    return `正在生成「${args.topic || ""}」练习题…`;
  }
  return `正在调用工具 ${name}…`;
}

function formatToolResult(
  name: string,
  args: Record<string, string>,
  result: string
): string {
  if (name === "search_knowledge_base") {
    return `🔍 已搜索「${args.query || ""}」，找到以下资料：\n${result.trim()}`;
  }
  if (name === "generate_practice") {
    return `📝 已生成「${args.topic || ""}」练习题：\n${result.trim()}`;
  }
  return `工具 ${name} 执行结果：\n${result.trim()}`;
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
    onToken: (data: {
      type: "text" | "tool_start" | "tool" | "done";
      content: string;
    }) => void
  ) {
    try {
      return await this._streamChatImpl(userMessage, onToken);
    } catch (e: any) {
      // 异常上抛给 chat.ts 的 catch
      throw e;
    }
  }

  // 实际实现拆出来,便于 outer try 包裹
  private async _streamChatImpl(
    userMessage: string,
    onToken: (data: {
      type: "text" | "tool_start" | "tool" | "done";
      content: string;
      truncated?: boolean;     // FIX: done 事件可携带,告诉前端内容被 max_tokens 截断
    }) => void
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
        // FIX: 从 1024 提升到 4096,避免长回答被 finishReason="length" 截断
        // 证据: debug-sse-abort-terminate P1 探针显示 iteration=1 时 finishReason=length, contentLength=1609
        max_tokens: 4096,
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
        //
        // 【流式排查】如果前端不是逐字出现，可在此处加日志打印 delta.content，
        // 看 for await...of 是不是在 LLM 生成过程中陆续拿到 token：
        //   - 若日志是逐字打印，但前端仍整段出现 → 问题在 sendSSEEvent/代理层。
        //   - 若日志也是等整段生成完后一次性打印 → 问题在 OpenAI SDK 或上游模型，
        //     需要确认 baseURL 对应的模型服务是否真的支持 stream=true。
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
          const args: Record<string, string> = JSON.parse(tc.arguments);
          // 先通知前端"正在执行工具"，避免空窗期
          onToken({
            type: "tool_start",
            content: formatToolStart(tc.name, args),
          });

          const result: string = await this.registry.execute(tc.name, args);

          onToken({
            type: "tool",
            content: formatToolResult(tc.name, args, result),
          });

          this.memory.addTool(result, tc.id);
        }

        // 所有 tool 执行完后统一压缩一次
        await this.memory.compressIfNeeded(this.summarizer, this.systemPrompt);
      } else {
        // 没有 tool call → 最终回答
        this.memory.addAssistant(content);
        // FIX: finishReason=length 时,通知前端内容被截断
        // v2: 用 truncated:true 结构化字段,前端用 v-if 决定是否显示"继续生成"按钮
        if (finishReason === "length") {
          onToken({
            type: "done",
            content,
            truncated: true,
          });
        } else {
          onToken({ type: "done", content });
        }
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
