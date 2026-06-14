import type { Tool, ToolRegistryType } from "../types.js";
import type { RAGEngine } from "../rag/rag-engine.js";
// ============================================================
// 工具定义

class ToolRegistry implements ToolRegistryType {
  tools: Tool[] = [];
  register(tool: Tool) {
    this.tools.push(tool);
  }
  get(name: string) {
    return this.tools.find(tool => tool.name === name);
  }
  list() {
    return this.tools;
  }
  async execute(name: string, args: Record<string, string>) {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`工具 ${name} 不存在`);
    }
    const params = tool.parameters as {required?: string[]}
    if (params.required) {
      params.required.forEach(param => {
        if (!(param in args)) {
          throw new Error(`缺少必填参数 ${param}`);
        }
      })
    }
    return await tool.execute(args);
  }
}
// ============================================================


/** 创建 RAG 知识库查询工具 */
function createRagTool(engine: RAGEngine): Tool {
  return {
    name: "search_knowledge_base",
    description: "在教材笔记中搜索相关内容，基于语义理解进行检索，返回最相关的知识点",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词或问题" },
      },
      required: ["query"],
    },
    async execute(args) {
      const { query } = args;
      return await engine.search(query, 3);
    },
  };
}

/** 模拟知识库查询（兜底，当没有 RAGEngine 时使用） */
const mockKnowledgeBase: Tool = {
  name: "search_knowledge_base",
  description: "在教材笔记中搜索相关内容",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索关键词" },
    },
    required: ["query"],
  },
  async execute(args) {
    const { query } = args;
    const db: Record<string, string> = {
      "期末重点章节":
        "=== 高等数学期末重点 ===\n" +
        "1. 函数与极限（10%）\n" +
        "2. 导数与微分（15%）\n" +
        "3. 不定积分（20%）\n" +
        "4. 定积分（25%）\n" +
        "5. 微分方程（30%）\n\n" +
        "推荐优先级：微分方程 > 定积分 > 不定积分 > 导数 > 极限",
      "考试安排":
        "=== 考试安排 ===\n" +
        "高数：6月20日 8:00-10:00\n" +
        "英语：6月22日 14:00-16:00\n" +
        "专业课：6月25日 9:00-11:00",
    };
    for (const [key, value] of Object.entries(db)) {
      if (key.includes(query) || query.includes(key)) {
        return value;
      }
    }
    return `未找到与「${query}」相关的资料。`;
  },
};

/** 模拟题目生成 */
const generatePractice: Tool = {
  name: "generate_practice",
  description: "生成指定科目的模拟练习题",
  parameters: {
    type: "object",
    properties: {
      topic: { type: "string", description: "科目或主题" },
      count: { type: "string", description: "题目数量" },
    },
    required: ["topic"],
  },
  async execute(args) {
    const count = parseInt(args.count ?? "3", 10);
    const questions = [
      "1. 求极限 lim(x→2) (x² - 4)/(x - 2)\n2. 求 y = x³ 的导数\n3. 计算 ∫(3x² + 2x)dx" +
        (count > 3 ? "\n4. 求微分方程 dy/dx = 2x 的通解\n5. 计算 ∫₀¹ x² dx" : ""),
    ];
    return `=== ${args.topic} 模拟题 ===\n${questions[0]}`;
  },
};

/** 注册所有可用工具 */
export function createTools(ragEngine?: RAGEngine): ToolRegistryType {
  const registry = new ToolRegistry();
  // 注册工具 — 有 RAGEngine 就用真的，否则用 mock
  registry.register(ragEngine ? createRagTool(ragEngine) : mockKnowledgeBase);
  registry.register(generatePractice);
  return registry;
}
