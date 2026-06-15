import type { LLM } from "../types/index.js";
import Anthropic from "@anthropic-ai/sdk";

export class ClaudeLLM implements LLM {
  private client: Anthropic;
  private model: string;

  constructor(model = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = model;
  }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{role: 'user', content: userMessage}],
    })
    const block = res.content[0]
    return block.type === 'text' ? block.text : ''
  }
}