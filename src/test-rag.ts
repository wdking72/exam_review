import { EmbeddingClient } from "./rag/embedding.js";
import { VectorStore } from "./rag/vector-store.js";
import { RAGEngine } from "./rag/rag-engine.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://api.siliconflow.cn/v1";
const API_KEY = process.env.API_KEY ?? "sk-garhxpfljifnvwtubmafvmvrwxjukaaolgcdmbghthebzxdv";
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const embed = new EmbeddingClient(BASE_URL, API_KEY, "BAAI/bge-m3");
  const store = new VectorStore();
  const engine = new RAGEngine(embed, store);

  // 加载知识库
  const kbPath = join(__dirname, "..", "knowledge", "高等数学（上）-期末速成.md");
  console.log("📖 正在加载知识库...");
  await engine.loadFromFile(kbPath);
  console.log("✅ 加载完成\n");

  // 测试查询
  const queries = ["怎么用洛必达法则", "分部积分法怎么用", "旋转体体积"];
  for (const q of queries) {
    console.log(`🔍 问题: "${q}"`);
    const result = await engine.search(q, 2);
    console.log(result);
    console.log("");
  }
}

main().catch(console.error);
