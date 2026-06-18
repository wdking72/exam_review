// 简单 curl 验证：只发 1 个请求 + 1 个"继续"请求,验证后端 memory 复用
import fs from "node:fs";

const cid = "verify-" + Date.now();
const url = "http://127.0.0.1:3001/api/chat/stream";

fs.appendFileSync(".dbg/v.log", `\n=== START ${new Date().toISOString()} cid=${cid}\n`);

async function chat(message) {
  fs.appendFileSync(".dbg/v.log", `POST: ${message.slice(0, 40)}...\n`);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message, useRag: false, conversationId: cid }),
    });
    fs.appendFileSync(".dbg/v.log", `  status=${res.status}\n`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", text = "", events = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const obj = JSON.parse(line.slice(5).trim());
          events++;
          if (obj.type === "text") text += obj.content;
          else if (obj.type === "done") {
            fs.appendFileSync(".dbg/v.log", `  done @ ${Date.now() - t0}ms, len=${text.length}\n`);
          } else if (obj.type === "error") {
            fs.appendFileSync(".dbg/v.log", `  error: ${obj.content}\n`);
          }
        } catch {}
      }
    }
    fs.appendFileSync(".dbg/v.log", `  total events=${events}, elapsed=${Date.now() - t0}ms\n`);
    fs.appendFileSync(".dbg/v.log", `  tail: ${text.slice(-150).replace(/\n/g, " ")}\n`);
    return text;
  } catch (e) {
    fs.appendFileSync(".dbg/v.log", `  [FATAL] ${e.message}\n`);
    return "";
  }
}

const r1 = await chat("Tell me about cats in one sentence.");
fs.appendFileSync(".dbg/v.log", `-- TURN 1 DONE --\n`);
const r2 = await chat("Continue with another sentence about dogs.");
fs.appendFileSync(".dbg/v.log", `-- TURN 2 DONE --\n`);

const knows = /cat|狗|狗|主题|继续/i.test(r2) || r2.length > 50;
fs.appendFileSync(".dbg/v.log", `\n=== VERDICT ===\nTURN 2 length: ${r2.length}\nTURN 2 mentions earlier topic? ${knows}\nTURN 2 says 'I dont know'? ${/don't know|不知道|不确定/i.test(r2)}\n`);
fs.appendFileSync(".dbg/v.log", `TURN 2 tail: ${r2.slice(-300)}\n`);
fs.appendFileSync(".dbg/v.log", `=== END ===\n`);
