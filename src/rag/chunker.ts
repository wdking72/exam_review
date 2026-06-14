export interface Chunk {
  id: string;
  text: string;
  heading: string;  // 所属标题（如 "极限计算方法"）
  index: number;
}

/**
 * Markdown 文档分块器
 *
 * 策略：
 * 1. 按 ## / ### 标题切分，每个标题下的内容作为一个基础块
 * 2. 如果某块超过 maxChunkSize，按段落（空行）进一步拆分
 * 3. 相邻块之间加 overlap，避免边界信息丢失
 */
export function chunkMarkdown(
  md: string,
  maxChunkSize: number = 800,
  overlap: number = 80
): Chunk[] {
  const sections = splitByHeadings(md);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const parts = splitLongSection(section, maxChunkSize);
    for (const part of parts) {
      // 除了第一个块，前面的块尾部加 overlap
      if (chunks.length > 0 && overlap > 0) {
        const prev = chunks[chunks.length - 1].text;
        chunks.push({
          id: "",
          text: prev.slice(-overlap) + "\n" + part,
          heading: section.heading,
          index: 0,
        });
      } else {
        chunks.push({ id: "", text: part, heading: section.heading, index: 0 });
      }
    }
  }

  return chunks.map((c, i) => ({ ...c, id: `chunk_${i}`, index: i }));
}

/** 按 ## / ### 标题切分 */
function splitByHeadings(md: string): { heading: string; content: string }[] {
  const result: { heading: string; content: string }[] = [];
  const lines = md.split("\n");
  let currentHeading = "（开头）";
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.+)/);
    if (headingMatch) {
      // 遇到新标题，先把之前的内容存起来
      if (currentLines.length > 0) {
        result.push({ heading: currentHeading, content: currentLines.join("\n").trim() });
      }
      currentHeading = headingMatch[2];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // 最后一段
  if (currentLines.length > 0) {
    result.push({ heading: currentHeading, content: currentLines.join("\n").trim() });
  }

  return result;
}

/**
 * 处理超长段落
 *
 * 核心逻辑：
 * 1. 如果内容 <= maxChunkSize，直接返回
 * 2. 如果超过，按空行切成段落，然后逐个合并，确保每块 <= maxChunkSize
 */
function splitLongSection(
  section: { heading: string; content: string },
  maxChunkSize: number
): string[] {
  const content = section.content;
  if (content.length <= maxChunkSize) return [content];

  // 按空行切段落
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
  const result: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    // 如果当前段落本身就超长，单独成块
    if (para.length > maxChunkSize) {
      if (current) result.push(current.trim());
      // 强行按字符切分这个长段落
      for (let i = 0; i < para.length; i += maxChunkSize) {
        result.push(para.slice(i, i + maxChunkSize).trim());
      }
      current = "";
      continue;
    }

    // 尝试合并段落
    const combined = current ? current + "\n\n" + para : para;
    if (combined.length > maxChunkSize) {
      // 加上当前段落会超，先把之前的收掉，重新开始
      result.push(current.trim());
      current = para;
    } else {
      current = combined;
    }
  }

  if (current.trim()) result.push(current.trim());
  return result;
}
