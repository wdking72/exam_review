import { EmbeddingClient } from "../rag/embedding.js";
import { VectorStore } from "../rag/vector-store.js";
import { KeywordSearch } from "../rag/keyword-search.js";
import { QueryRewriter } from "../rag/query-rewriter.js";
import { RAGEngine } from "../rag/rag-engine.js";
import { OpenAICompatibleLLM } from "../llm/llm-openai.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://api.siliconflow.cn/v1";
const API_KEY = process.env.API_KEY ?? "sk-garhxpfljifnvwtubmafvmvrwxjukaaolgcdmbghthebzxdv";
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const embed = new EmbeddingClient(BASE_URL, API_KEY, "BAAI/bge-m3");
  const store = new VectorStore();
  const keywordSearch = new KeywordSearch();

  // 用硅基流动的 LLM 做查询改写
  const llm = new OpenAICompatibleLLM(BASE_URL, "nex-agi/Nex-N2-Pro", API_KEY);
  const queryRewriter = new QueryRewriter(llm);

  // 完整引擎：向量 + 关键词 + 改写
  const engine = new RAGEngine(embed, store, keywordSearch, queryRewriter);

  const kbPath = join(__dirname, "..", "..", "knowledge", "高等数学（上）-期末速成.md");
  console.log("📖 正在加载知识库...\n");
  await engine.loadFromFile(kbPath);
  console.log("✅ 加载完成\n");

  // 对比测试：纯向量 vs 混合检索
  const queries = ["怎么用洛必达法则", "什么是旋转体体积", "分部积分法怎么用"];

  for (const q of queries) {
    console.log("=".repeat(60));
    console.log(`🔍 问题: "${q}"`);

    // 先看改写结果
    const rewritten = await queryRewriter.rewrite(q);
    console.log(`✏️  改写后: "${rewritten}"\n`);

    // 混合检索结果
    const result = await engine.search(q, 2);
    console.log("📎 检索结果:\n", result);
    console.log("");
  }
}

main().catch(console.error);
