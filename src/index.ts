// ============================================================
// 入口文件
// ============================================================

import { Agent } from "./core/agent.js";
import { MockLLM } from "./llm/llm.js";
import { ClaudeLLM } from "./llm/llm-claude.js";
import { OpenAICompatibleLLM } from "./llm/llm-openai.js";
import { NativeToolAgent } from "./core/agent-native.js";
import { MemoryManager } from "./core/memory.js";
import { createTools } from "./tools/tools.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {  dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initRag } from "./rag/init-rag.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const useRealLLM = process.argv.includes("--real");
const useOpenAI = process.argv.includes("--openai");
const useNative =
  process.argv.includes("--native") || process.argv.includes("--summarize");
const useSummarize = process.argv.includes("--summarize");
const useChat = process.argv.includes("--chat");
// const useRag = process.argv.includes("--rag");

const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.siliconflow.cn/v1";
const API_KEY = process.env.API_KEY ?? "sk-garhxpfljifnvwtubmafvmvrwxjukaaolgcdmbghthebzxdv";

const llm = useOpenAI
  ? new OpenAICompatibleLLM(API_BASE_URL, process.env.MODEL ?? "nex-agi/Nex-N2-Pro", API_KEY)
  : useRealLLM
    ? new ClaudeLLM()
    : new MockLLM();

/** 初始化 RAG 引擎并加载知识库 */
// async function initRag(): Promise<RAGEngine | undefined> {
//   if (!useRag) return undefined;
//   const embed = new EmbeddingClient(API_BASE_URL, API_KEY, "BAAI/bge-m3");
//   const store = new VectorStore();
//   const engine = new RAGEngine(embed, store);
//   const kbPath = join(__dirname, "..", "knowledge", "高等数学（上）-期末速成.md");
//   console.log("\n📖 正在加载高数知识库...");
//   await engine.loadFromFile(kbPath);
//   console.log("✅ 知识库加载完成\n");
//   return engine;
// }

const SYSTEM_PROMPT = `你是一个期末复习助手，帮助大学生准备考试。
你有工具可用，需要时使用它们，不需要时直接回答。
始终用中文回答。`;

const question = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!question && !useChat) {
  console.log("用法:");
  console.log('  npm run dev -- "你的问题"            # Mock 模式');
  console.log('  npm run dev -- --native "你的问题"   # Native Tool Use');
  console.log('  npm run dev -- --summarize "你的问题" # 带摘要压缩');
  console.log('  npm run dev -- --chat               # 交互式多轮对话');
  console.log('  npm run dev -- --real "你的问题"     # Claude API');
  console.log('  npm run dev -- --rag --native "你的问题" # 启用 RAG 知识库检索');
  process.exit(1);
}

// ============================================================
// 交互式多轮对话模式
// ============================================================
async function chatMode(tools: ReturnType<typeof createTools>) {
  const memory = new MemoryManager(
    useSummarize
      ? { strategy: "summarization", maxTurns: 1, maxTokens: 50 }
      : { strategy: "sliding-window", maxTurns: 10 }
  );
  const agent = new NativeToolAgent({
    baseURL:
      process.env.API_BASE_URL ?? "https://api.siliconflow.cn/v1",
    apiKey:
      process.env.API_KEY ??
      "sk-garhxpfljifnvwtubmafvmvrwxjukaaolgcdmbghthebzxdv",
    model: process.env.MODEL ?? "nex-agi/Nex-N2-Pro",
    registry: tools,
    memory,
  });

  // 用 init() 设置 system prompt，不触发对话
  agent.init(SYSTEM_PROMPT);

  console.log("\n📚 期末复习助手已就绪（输入 exit 退出）\n");

  const rl = readline.createInterface({ input, output });

  // 用 async iterator 逐行读 stdin（兼容 pipe 和交互模式）
  for await (const msg of rl) {
    if (msg.toLowerCase() === "exit") break;
    if (!msg.trim()) continue;

    process.stdout.write("\n");

    await agent.streamChat(msg, (data) => {
      if (data.type === "text") {
        process.stdout.write(data.content);
      } else if (data.type === "tool") {
        process.stdout.write(data.content);
      } else if (data.type === "done") {
        process.stdout.write("\n\n");
      }
    });

    // 显示 memory 状态
    const stats = agent.getMemoryStats();
    process.stdout.write(
      `[memory: ${stats.totalTurns} turns, ~${stats.totalTokens} tokens, strategy: ${stats.strategy}]\n\n`
    );

  }

  rl.close();
}

// ============================================================
// 单次运行模式
// ============================================================
async function main() {
  // 初始化 RAG（如果启用）
  const ragEngine = await initRag();
  const tools = createTools(ragEngine);

  if (useChat) {
    await chatMode(tools);
  } else if (useNative) {
    const memory = new MemoryManager(
      useSummarize
        ? { strategy: "summarization", maxTurns: 1, maxTokens: 50 }
        : { strategy: "sliding-window", maxTurns: 10 }
    );
    const agent = new NativeToolAgent({
      baseURL: API_BASE_URL,
      apiKey: API_KEY,
      model: process.env.MODEL ?? "nex-agi/Nex-N2-Pro",
      registry: tools,
      memory,
    });
    const result = await agent.run(SYSTEM_PROMPT, question ?? "");

    console.log("\n--- 最终答案 ---\n");
    console.log(result.answer);

    console.log("\n--- 思考过程 ---");
    for (const step of result.steps) {
      if (step.toolCall)
        console.log(
          `  🛠  ${step.toolCall.name}(${JSON.stringify(step.toolCall.arguments)})`
        );
      if (step.toolResult)
        console.log(`  📥 ${step.toolResult.slice(0, 80)}...`);
      if (step.answer)
        console.log(`  💬 ${step.answer.slice(0, 100)}...`);
    }

    const stats = agent.getMemoryStats();
    console.log("\n--- Memory 状态 ---");
    console.log(`  策略: ${stats.strategy}`);
    console.log(`  maxTurns: ${stats.maxTurns}`);
    console.log(`  轮数: ${stats.totalTurns}`);
    console.log(`  估算 token: ${stats.totalTokens}`);
    console.log(`  摘要长度: ${stats.summaryLength}`);
  } else {
    const agent = new Agent({
      systemPrompt: SYSTEM_PROMPT,
      maxIterations: 5,
      tools,
      llm,
    });
    const result = await agent.run(question ?? "");

    console.log("\n--- 最终答案 ---\n");
    console.log(result.answer);

    console.log("\n--- 思考过程 ---");
    for (const step of result.steps) {
      if (step.thought) console.log(`  💭 ${step.thought}`);
      if (step.toolCall)
        console.log(
          `  🛠  ${step.toolCall.name}(${JSON.stringify(step.toolCall.arguments)})`
        );
      if (step.toolResult)
        console.log(`  📥 ${step.toolResult.slice(0, 80)}...`);
    }
  }
}

main().catch(console.error);
