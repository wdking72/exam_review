// ============================================================
// Memory 管理 — Context 压缩与策略管理
// ============================================================
//
// 核心问题: Agent 每轮对话都在 messages 里追加内容，
// 不管理的话 token 会无限增长，导致:
//   1. context window 溢出 → API 报错
//   2. 推理变慢、成本增加
//   3. Lost-in-the-Middle 效应
//
// 两种策略:
//   sliding-window: 只保留最近 N 轮，超出的丢弃
//   summarization:  超出阈值时把旧轮压缩成摘要
// ============================================================

import type { LLM } from "../types/index.js";

export type MemoryStrategy = "sliding-window" | "summarization";

export interface MemoryConfig {
  strategy: MemoryStrategy;
  maxTurns: number;    // 保留最近几轮
  maxTokens: number;   // summarization 的触发阈值
}

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

// ============================================================
// Token 估算（不调用 API，纯本地）
//
// 为什么需要？— 决定何时触发压缩。
// 不需要精确，只需要一个相对可靠的估算值。
//
// OpenAI 的编码方式: 中文约 1.5 token/字，英文约 0.25 token/字符
// ============================================================
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    if (/[一-鿿]/.test(char)) {
      tokens += 1.5;   // 中文字符
    } else if (/\s/.test(char)) {
      tokens += 0.25;  // 空白
    } else {
      tokens += 0.25;  // 英文字符
    }
  }
  return Math.ceil(tokens);
}

// ============================================================
// MemoryManager
//
// 职责:
//   1. 存储所有消息 (addUser / addAssistant / addTool / addSystem)
//   2. 按策略裁剪后返回 (getMessages — 给 LLM 用的)
//   3. 超阈值时自动压缩 (compressIfNeeded)
//   4. 暴露监控数据 (getStats)
// ============================================================
export class MemoryManager {
  private messages: Message[] = [];
  private config: MemoryConfig;
  private summary = "";          // summarization 策略下的历史摘要

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      strategy: "sliding-window",
      maxTurns: 10,
      maxTokens: 4000,
      ...config,
    };
  }

  // ---- 消息追加 ----

  addSystem(content: string) {
    this.messages.push({ role: "system", content });
  }

  addUser(content: string) {
    this.messages.push({ role: "user", content });
  }

  addAssistant(content: string, tool_calls?: unknown[]) {
    this.messages.push({ role: "assistant", content, tool_calls });
  }

  addTool(content: string, tool_call_id: string) {
    this.messages.push({ role: "tool", content, tool_call_id });
  }

  // ---- 查询 ----

  /** 获取裁剪后的消息（给 LLM 调用） */
  getMessages(): Message[] {
    if (this.messages.length === 0) return [];

    // system 消息始终保留
    const systemMsgs = this.messages.filter((m) => m.role === "system");
    const nonSystem = this.messages.filter((m) => m.role !== "system");

    if (this.config.strategy === "sliding-window") {
      // 保留最近 maxTurns 轮（每轮 user + assistant + tool ≈ 2 条消息）
      const keep = this.config.maxTurns * 2;
      return [...systemMsgs, ...nonSystem.slice(-keep)];
    }

    // summarization: 把历史摘要合并进 system prompt，避免连续出现两条 user 消息
    const recent = nonSystem.slice(-this.config.maxTurns * 2);
    if (this.summary && systemMsgs.length > 0) {
      systemMsgs[systemMsgs.length - 1].content += `\n\n[历史摘要] ${this.summary}`;
    }
    return [...systemMsgs, ...recent];
  }

  // ---- 压缩 ----

  /**
   * 检查 token 数，超过阈值则压缩
   *
   * 思路:
   *  1. 估算当前总 token
   *  2. 如果没超阈值 → 不动
   *  3. 如果超了 → 把最旧的 N 轮提取出来
   *  4. 让 LLM 把这部分压缩成一段摘要
   *  5. 用摘要替换被压缩的内容
   */
  async compressIfNeeded(llm: LLM, systemPrompt: string) {
    if (this.config.strategy !== "summarization") return;

    const totalTokens = estimateTokens(
      this.messages.map((m) => m.content).join("")
    );

    if (totalTokens <= this.config.maxTokens) return;

    // 保留最近 maxTurns 轮不压缩
    const keepCount = this.config.maxTurns * 2;
    const toSummarize = this.messages
      .filter((m) => m.role !== "system")
      .slice(0, -keepCount);

    if (toSummarize.length === 0) return;

    // 把要压缩的部分拼成文本
    const textToCompress = toSummarize
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n");

    // 调用 LLM 生成摘要
    const newSummary = await llm.generate(
      systemPrompt,
      `请用中文概括以下对话历史的核心信息（用户问了什么、已经获取了什么结果、还有哪些待办）：\n\n${textToCompress}`
    );

    this.summary = newSummary;

    // 从 messages 中移除被压缩的部分
    this.messages = [
      ...this.messages.filter((m) => m.role === "system"),
      ...this.messages.filter((m) => m.role !== "system").slice(-keepCount),
    ];
  }

  // ---- 监控 ----

  getStats() {
    const totalTokens = estimateTokens(
      this.messages.map((m) => m.content).join("")
    );
    return {
      totalTurns: Math.floor((this.messages.filter(m => m.role !== "system").length) / 2),
      totalTokens,
      summaryLength: this.summary.length,
      strategy: this.config.strategy,
      maxTokens: this.config.maxTokens,
      maxTurns: this.config.maxTurns,
    };
  }

  /** 原始消息数（调试用） */
  getRawCount() {
    return this.messages.length;
  }
}
