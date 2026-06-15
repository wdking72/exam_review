import { RAGEngine } from "./rag-engine.js"
import { EmbeddingClient } from "./embedding.js"
import { VectorStore } from "./vector-store.js"
import { join } from "node:path"

  const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.siliconflow.cn/v1"
  const API_KEY = process.env.API_KEY ?? ""

export async function initRag():  Promise<RAGEngine | undefined> {
  try{
      const embed = new EmbeddingClient(API_BASE_URL, API_KEY, "BAAI/bge-m3");
      const store = new VectorStore()
      const engine = new RAGEngine(embed, store)
      const kbPath = join(process.cwd(), "knowledge", "高等数学（上）-期末速成.md")
      console.log("\n📖 正在加载高数知识库...")
      await engine.loadFromFile(kbPath)
      console.log("✅ 知识库加载完成\n")
      return engine;
      }catch(err){
          console.error("知识库加载失败:", err)
          return undefined
      }

}