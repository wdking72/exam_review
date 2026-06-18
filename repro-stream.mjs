// 复现脚本：触发长回答 + 把 SSE 流保存到文件
import fs from "node:fs";
import path from "node:path";

const message = process.argv[2] || "请用 Markdown 详细列出基本初等函数:幂函数、指数函数、对数函数、三角函数、反三角函数、常量函数。每种函数的定义、公式、典型例子、图像特点都要写出来。每个函数至少给3个例子。一定要写完整,不要中途停止。";

const url = "http://127.0.0.1:3001/api/chat/stream";
const out = path.resolve(".dbg/repro-stream.ndjson");

console.log(`[repro] POST ${url}`);
console.log(`[repro] message length: ${message.length}`);
console.log(`[repro] output: ${out}`);

const t0 = Date.now();
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ message, useRag: false }),
});

console.log(`[repro] status: ${res.status}, took ${Date.now() - t0}ms for headers`);

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = "";
let totalText = "";
let eventCount = 0;
let lastEventType = null;
let lastContent = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) {
    console.log(`[repro] stream done (read returned done=true), elapsed=${Date.now() - t0}ms`);
    break;
  }
  buf += decoder.decode(value, { stream: true });
  const lines = buf.split("\n");
  buf = lines.pop() || "";
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("event:")) continue;
    if (!t.startsWith("data:")) continue;
    const json = t.slice(5).trim();
    if (!json) continue;
    try {
      const obj = JSON.parse(json);
      eventCount++;
      lastEventType = obj.type;
      if (obj.type === "text") {
        totalText += obj.content;
        lastContent = obj.content;
      } else if (obj.type === "done") {
        lastContent = obj.content;
        console.log(`[repro] === DONE EVENT ===`);
        console.log(`[repro] done.content length: ${obj.content?.length}`);
        console.log(`[repro] done.content tail (last 200 chars): ${obj.content?.slice(-200)}`);
      } else if (obj.type === "error") {
        console.log(`[repro] === ERROR EVENT === ${obj.content}`);
      } else {
        console.log(`[repro] event: type=${obj.type} contentPreview=${String(obj.content || "").slice(0, 80)}`);
      }
    } catch (e) {
      console.log(`[repro] failed to parse line: ${t.slice(0, 100)}`);
    }
  }
}

console.log(`[repro] === SUMMARY ===`);
console.log(`[repro] total events: ${eventCount}`);
console.log(`[repro] last event type: ${lastEventType}`);
console.log(`[repro] accumulated text length (from text events): ${totalText.length}`);
console.log(`[repro] accumulated text tail (last 200): ${totalText.slice(-200)}`);
console.log(`[repro] total elapsed: ${Date.now() - t0}ms`);

fs.writeFileSync(out, JSON.stringify({
  message,
  totalEvents: eventCount,
  lastEventType,
  textLength: totalText.length,
  textTail: totalText.slice(-500),
  elapsedMs: Date.now() - t0,
}, null, 2));
console.log(`[repro] summary saved to ${out}`);
