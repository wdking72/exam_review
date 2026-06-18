<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import katex from 'katex'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'

const props = defineProps<{
  content: string
}>()

// ==================== 数学公式处理 ====================
// LLM 返回的 LaTeX 语法（如 \frac{x}{y}）中的 _、\、{ 等字符
// 会被 marked 当作 Markdown 语法解析，导致公式被破坏。
// 解决方案：在 marked 解析前，先提取数学公式用占位符替换，
// marked 解析完成后再把 KaTeX 渲染结果替换回来。
const MATH_PLACEHOLDER = '%%MATH_BLOCK_'
let mathIndex = 0
const mathBlocks: string[] = []

// 提取数学公式并替换为占位符
// 支持格式：\[...\]（行间）、$$...$$（行间）、\(...\)（行内）、$...$（行内）
function extractMath(text: string): string {
  // 行间公式：\[...\] 和 $$...$$（贪婪匹配，支持多行）
  text = text.replace(/\\\[[\s\S]*?\\\]/g, (m) => {
    const latex = m.slice(2, -2).trim()
    const html = renderMath(latex, true)
    const placeholder = `${MATH_PLACEHOLDER}${mathIndex++}%%`
    mathBlocks.push(html)
    return placeholder
  })
  text = text.replace(/\$\$[\s\S]*?\$\$/g, (m) => {
    const latex = m.slice(2, -2).trim()
    const html = renderMath(latex, true)
    const placeholder = `${MATH_PLACEHOLDER}${mathIndex++}%%`
    mathBlocks.push(html)
    return placeholder
  })

  // 行内公式：\(...\)（非贪婪，避免吃掉相邻文本）
  text = text.replace(/\\\([\s\S]*?\\\)/g, (m) => {
    const latex = m.slice(2, -2).trim()
    const html = renderMath(latex, false)
    const placeholder = `${MATH_PLACEHOLDER}${mathIndex++}%%`
    mathBlocks.push(html)
    return placeholder
  })

  // 行内公式：$...$（跳过 $$，只匹配单 $）
  // 要求 $ 前后不是空格/数字，避免误匹配货币符号
  text = text.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_m, latex) => {
    const html = renderMath(latex.trim(), false)
    const placeholder = `${MATH_PLACEHOLDER}${mathIndex++}%%`
    mathBlocks.push(html)
    return placeholder
  })

  return text
}

// KaTeX 渲染：将 LaTeX 字符串转为 HTML
// displayMode=true 时渲染为居中的独立公式块，false 时渲染为行内公式
function renderMath(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,   // 渲染失败不抛异常，降级显示原始文本
      output: 'html',
      strict: 'ignore',      // FIX: 关闭严格模式,避免 math 块内含中文时报 warn 刷屏
                             //      学术内容常常 $向量的模: |a|$ 之类,KaTeX 默认 strict='warn' 会刷屏
    })
  } catch {
    return `<code>${latex}</code>`
  }
}

// 恢复占位符为 KaTeX 渲染结果
function restoreMath(html: string): string {
  mathBlocks.forEach((block, i) => {
    html = html.replace(new RegExp(`${MATH_PLACEHOLDER}${i}%%`, 'g'), block)
  })
  return html
}

// ==================== 代码高亮 ====================
// 注册自定义渲染器：让 marked 在遇到代码块时调用 highlight.js 进行语法高亮
// marked 的 renderer 机制：拦截 ```lang 代码块，用 hljs.highlight() 替换默认输出
const renderer = new marked.Renderer()
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  // 根据语言标识（如 ```python）选择对应的高亮规则
  // 如果语言不存在或未指定，hljs 会自动检测（autoDetection）
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  const highlighted = hljs.highlight(text, { language }).value

  // 输出带 hljs class 的 <pre><code>，供 highlight.js CSS 生效
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
}

// 配置 marked：启用 GFM（表格、任务列表等）和换行符转 <br>
marked.setOptions({
  gfm: true,
  breaks: true,
})

// ==================== 主渲染流程 ====================
// 流程：提取数学公式 → marked 解析 Markdown → 恢复数学公式 → DOMPurify 消毒
const sanitizedHtml = computed(() => {
  if (!props.content) return ''

  // 每次渲染重置状态（computed 会重复执行）
  mathIndex = 0
  mathBlocks.length = 0

  // 1. 提取数学公式，用占位符替换，防止 marked 破坏 LaTeX 语法
  const mathExtracted = extractMath(props.content)

  // 2. marked 将 Markdown 语法转成 HTML 字符串（使用自定义 renderer 实现代码高亮）
  const rawHtml = marked.parse(mathExtracted, { renderer }) as string

  // 3. 将占位符替换回 KaTeX 渲染后的 HTML
  const withMath = restoreMath(rawHtml)

  // 4. DOMPurify 消毒：移除所有 XSS 攻击向量
  //    - 剥离 <script>、<iframe>、<object> 等危险标签
  //    - 清除 onerror、onclick 等事件属性
  //    - 过滤 javascript:、data: 等危险 URL scheme
  //    - KaTeX 输出的 <span>、<math> 等标签在白名单中保留
  return DOMPurify.sanitize(withMath, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'em', 'del', 'code', 'pre',
      'blockquote',
      'a',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'span',                    // KaTeX 高亮用 <span> 嵌套
      'math', 'mi', 'mo', 'mn', // KaTeX MathML 输出
      'mrow', 'mfrac', 'msup', 'msub', 'munder', 'mover',
      'msqrt', 'mphantom', 'mpadded', 'mtable', 'mtr', 'mtd',
      'annotation', 'semantics', 'menclose', 'mstyle',
      'svg', 'path', 'line', 'rect', 'circle', 'g', 'use',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'class',                 // 代码高亮、KaTeX 样式
      'style',                 // KaTeX 内联样式（定位、字号等）
      'aria-hidden',           // KaTeX 装饰性元素
      'width', 'height',       // KaTeX SVG 尺寸
      'viewBox',               // KaTeX SVG 视口
      'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', // KaTeX SVG 路径
      'transform',             // KaTeX SVG 变换
      'xmlns',                 // KaTeX SVG 命名空间
      'mathvariant',           // MathML 字体变体
      'displaystyle',          // MathML 显示模式
      'stretchy',              // MathML 拉伸符号
    ],
  })
})
</script>

<template>
  <!-- v-html 渲染消毒后的 HTML，class 中的 prose 样式提供排版美化 -->
  <div class="markdown-body" v-html="sanitizedHtml" />
</template>

<style scoped>
/* Markdown 排版样式 */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-weight: 700;
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  line-height: 1.3;
}
.markdown-body :deep(h1) { font-size: 1.5em; }
.markdown-body :deep(h2) { font-size: 1.3em; }
.markdown-body :deep(h3) { font-size: 1.1em; }

.markdown-body :deep(p) {
  margin: 0.6em 0;
  line-height: 1.75;
}

/* 有序/无序列表缩进 */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.markdown-body :deep(li) {
  margin: 0.25em 0;
}
.markdown-body :deep(ul) {
  list-style-type: disc;
}
.markdown-body :deep(ol) {
  list-style-type: decimal;
}

/* 引用块 */
.markdown-body :deep(blockquote) {
  border-left: 4px solid #d1d5db;
  padding-left: 1em;
  color: #6b7280;
  margin: 0.8em 0;
}

/* 行内代码 */
.markdown-body :deep(code) {
  background: #f3f4f6;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* 代码块 — highlight.js 会注入带颜色的 <span>，这里只做容器样式 */
.markdown-body :deep(pre) {
  background: #f6f8fa;
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.8em 0;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #24292e;
  font-size: 0.9em;
}

/* 表格 */
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.5em 0.75em;
  text-align: left;
}
.markdown-body :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}

/* 链接 */
.markdown-body :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}
.markdown-body :deep(a:hover) {
  color: #1d4ed8;
}

/* 分隔线 */
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.2em 0;
}

/* 数学公式 */
.markdown-body :deep(.katex-display) {
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.5em 0;
}
.markdown-body :deep(.katex) {
  font-size: 1.1em;
}
</style>
