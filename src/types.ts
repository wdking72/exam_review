// ============================================================
// 核心类型定义
// ============================================================

/** 工具调用的参数 */
export interface ToolCall {
  name: string;
  arguments: Record<string, string>;
}

/** Agent 执行的每一步 */
export interface AgentStep {
  thought?: string;
  toolCall?: ToolCall;
  toolResult?: string;
  answer?: string;
}

/** 工具的元数据定义 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** 工具接口：定义 + 执行逻辑 */
export interface Tool extends ToolDefinition {
  execute(args: Record<string, string>): Promise<string>;
}

export interface ToolRegistryType {
  tools: Tool[],
  register: (tool: Tool) => void,
  get: (name: string) => Tool | undefined,
  list: () => Tool[],
  execute(name: string, args: Record<string, string>): Promise<string>,
}

/** LLM 接口（可切换 mock / 真实） */
export interface LLM {
  generate(systemPrompt: string, userMessage: string): Promise<string>;
}

/** Agent 配置 */
export interface AgentConfig {
  systemPrompt: string;
  maxIterations: number;
  tools: ToolRegistryType;
  llm: LLM;
}

/** Agent 执行结果 */
export interface AgentResult {
  answer: string;
  steps: AgentStep[];
}
