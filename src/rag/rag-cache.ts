/**
 * Embedding 缓存工具
 *
 * 将文件分块后的 embedding 结果缓存到本地，
 * 文件未变更时下次启动直接读缓存，省去 API 调用。
 */

import { writeFile, stat, mkdir, readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import type { CacheData } from "../types/rag.js"

/** 缓存目录：项目根目录下的 .rag-cache/ */
const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, "..", "..", ".rag-cache")

/**
 * 生成缓存文件路径
 * 用文件路径 + 修改时间做 key，文件变更后自动失效
 */
function cacheKey(filePath: string, mtimeMs: number): string {
  const hash = createHash("md5").update(`${filePath}@${mtimeMs}`).digest("hex")
  return join(CACHE_DIR, `${hash}.json`)
}

/** 尝试读取缓存，不存在或损坏返回 null */
export async function loadCache(filePath: string): Promise<CacheData | null> {
  try {
    const mtime = (await stat(filePath)).mtimeMs
    const path = cacheKey(filePath, mtime)
    if (!existsSync(path)) return null
    return JSON.parse(await readFile(path, "utf-8"))
  } catch {
    return null
  }
}

/** 写入 embedding 缓存（文件不变时下次直接复用） */
export async function saveCache(filePath: string, data: CacheData): Promise<void> {
  try {
    if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true })
    const mtime = (await stat(filePath)).mtimeMs
    const path = cacheKey(filePath, mtime)
    await writeFile(path, JSON.stringify(data), "utf-8")
  } catch {
    // 缓存失败不影响主流程
  }
}
