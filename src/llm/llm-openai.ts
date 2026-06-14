import OpenAI from "openai";
import type { LLM } from "../types.js";

export class OpenAICompatibleLLM implements LLM {
  private client: OpenAI;
  private model: string;

  constructor(
    baseURL: string,
    model: string,
    apiKey: string
  ) {
    this.client = new OpenAI({ baseURL, apiKey });
    this.model = model;
  }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    return res.choices[0]?.message?.content ?? "";
  }
}
