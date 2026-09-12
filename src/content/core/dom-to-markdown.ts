/**
 * MarkCraft DOM-to-Markdown Serializer
 * Accurately converts contenteditable HTML DOM back into standard GitHub Flavored Markdown (GFM).
 *
 * 转换规则全部位于 Rust（wasm/markdown_analyzer 的 dom_to_markdown）；
 * JS 端只负责采集通用 DOM 快照，并在 WASM 不可用时回退到本地等价实现。
 */
import { loadAnalyzer } from './wasm_analyzer'

interface SerializedNode {
  tag?: string
  classes?: string[]
  attrs?: Record<string, string>
  text?: string
  children?: SerializedNode[]
}

// MarkCraft 注入的 UI 辅助元素，序列化时整体剔除
// （.mdr-code-header 的语言标签文本不应混入保存结果）
const UI_HELPER_SELECTOR =
  '.mdr-code-copy-btn, .mdr-image-wrapper button, .mdr-in-place-toolbar, .mdr-code-header'

// 快照深度上限：真实文档的 DOM 嵌套远低于该值；恶意/病态页面超出后剪枝，
// 使 WASM 与 JS 两条递归序列化路径都不会触发栈溢出（call stack exhausted）
const MAX_SNAPSHOT_DEPTH = 512
let depthLimitWarned = false

/**
 * 通用 DOM 快照：仅采集标签、类名、属性、文本与复选框状态，
 * 不包含任何 Markdown 转换规则。
 */
function serializeNode(node: Node, depth = 0): SerializedNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { text: node.textContent || '' }
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }
  const el = node as HTMLElement
  if (el.closest(UI_HELPER_SELECTOR)) {
    return null
  }
  if (depth > MAX_SNAPSHOT_DEPTH) {
    if (!depthLimitWarned) {
      depthLimitWarned = true
      console.warn('[MarkCraft] DOM snapshot depth limit reached; content beyond depth', MAX_SNAPSHOT_DEPTH, 'was skipped')
    }
    return null
  }
  const attrs: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = attr.value
  }
  // 复选框的用户勾选状态只存在于 property，不反映在 attribute 中
  if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    attrs.checked = el.checked ? 'true' : 'false'
  }
  const children: SerializedNode[] = []
  el.childNodes.forEach((child) => {
    const serialized = serializeNode(child, depth + 1)
    if (serialized) children.push(serialized)
  })
  return {
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList),
    attrs,
    children
  }
}

export async function domToMarkdown(root: HTMLElement): Promise<string> {
  const analyzer = await loadAnalyzer()
  if (analyzer) {
    try {
      const result = analyzer.dom_to_markdown(serializeNode(root))
      if (typeof result === 'string') return result
    } catch {
      // 回退到 JS 实现
    }
  }
  return domToMarkdownFallback(root)
}

/** JS 回退实现：与 WASM 版规则保持一致。 */
function domToMarkdownFallback(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement

  // Remove UI helper elements injected by MarkCraft (copy buttons, lightbox overlays, etc.)
  clone.querySelectorAll(UI_HELPER_SELECTOR).forEach((el) => el.remove())

  return nodeToMarkdown(clone, 0, false).trim() + '\n'
}

/** 内容中最长连续反引号串的长度（用于选择不会提前闭合的围栏）。 */
function longestBacktickRun(content: string): number {
  let max = 0
  let current = 0
  for (const ch of content) {
    if (ch === '`') {
      current += 1
      if (current > max) max = current
    } else {
      current = 0
    }
  }
  return max
}

/** 围栏长度取 minLen 与「最长反引号串 + 1」的较大者，避免内容把围栏提前闭合。 */
function makeFence(run: number, minLen: number): string {
  return '`'.repeat(Math.max(run, minLen))
}

/**
 * 文本节点最小转义：`*`/`_`/`#`/`[` 恒转义，`]` 在链接文本内转义，
 * 防止正文里的这些字符被解析为强调、标题或链接结构（与 Rust 端 escapeText 一致）。
 */
function escapeText(text: string, insideLink: boolean): string {
  let out = ''
  for (const ch of text) {
    if (ch === '*' || ch === '_' || ch === '#' || ch === '[' || (ch === ']' && insideLink)) {
      out += `\\${ch}`
    } else {
      out += ch
    }
  }
  return out
}

/** 链接/图片地址里的括号会被当作地址终点之外的结构字符，转义为百分号编码。 */
function escapeLinkUrl(url: string): string {
  return url.replace(/\(/g, '%28').replace(/\)/g, '%29')
}

function nodeToMarkdown(node: Node, depth: number, insideTable: boolean, insideLink: boolean = false): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeText(node.textContent || '', insideLink)
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  // Handle KaTeX formulas
  if (el.classList.contains('katex') || el.classList.contains('katex-display')) {
    const texAnnotation = el.querySelector('annotation[encoding="application/x-tex"]')
    if (texAnnotation && texAnnotation.textContent) {
      const isDisplay = el.classList.contains('katex-display') || el.parentElement?.classList.contains('katex-display')
      return isDisplay ? `\n$$\n${texAnnotation.textContent.trim()}\n$$\n` : `$${texAnnotation.textContent.trim()}$`
    }
  }

  // Handle Mermaid diagrams
  if (el.classList.contains('mermaid') || el.getAttribute('data-mermaid')) {
    const code = (el.getAttribute('data-mermaid-source') || el.textContent || '').trim()
    const fence = makeFence(longestBacktickRun(code) + 1, 3)
    return `\n${fence}mermaid\n${code}\n${fence}\n`
  }

  // Handle GitHub Alerts / Callouts
  if (el.classList.contains('markdown-alert')) {
    let alertType = 'NOTE'
    if (el.classList.contains('markdown-alert-tip')) alertType = 'TIP'
    else if (el.classList.contains('markdown-alert-important')) alertType = 'IMPORTANT'
    else if (el.classList.contains('markdown-alert-warning')) alertType = 'WARNING'
    else if (el.classList.contains('markdown-alert-caution')) alertType = 'CAUTION'

    const titleEl = el.querySelector('.markdown-alert-title')
    if (titleEl) titleEl.remove()

    const innerContent = getChildrenMarkdown(el, depth, insideTable, insideLink).trim()
    const lines = innerContent.split('\n').map((l) => `> ${l}`).join('\n')
    return `\n> [!${alertType}]\n${lines}\n`
  }

  // Handle Code Blocks
  if (tag === 'pre') {
    const mermaidInside = el.querySelector('.mermaid, [data-mermaid]')
    if (mermaidInside) {
      return nodeToMarkdown(mermaidInside, depth, insideTable)
    }
    const codeEl = el.querySelector('code') || el
    let lang = ''
    codeEl.classList.forEach((cls) => {
      if (cls.startsWith('language-')) lang = cls.replace('language-', '')
    })
    const rawCode = (codeEl.textContent || '').replace(/\n+$/, '')
    // 内容含 ``` 时三反引号围栏会被提前闭合，按内容选择更长的围栏
    const fence = makeFence(longestBacktickRun(rawCode) + 1, 3)
    return `\n${fence}${lang}\n${rawCode}\n${fence}\n`
  }

  // Handle Inline Code
  if (tag === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') {
    const content = el.textContent || ''
    const fence = makeFence(longestBacktickRun(content) + 1, 1)
    // 内容以反引号开头/结尾（或为空）时按 CommonMark 用空格与围栏分隔
    const pad = !content || content.startsWith('`') || content.endsWith('`') ? ' ' : ''
    return `${fence}${pad}${content}${pad}${fence}`
  }

  // Handle Headings：HTML 不存在 h7+，超范围级别收口到 h6 与 WASM 版一致
  if (/^h[1-9]$/.test(tag)) {
    const level = Math.min(parseInt(tag[1], 10), 6)
    const prefix = '#'.repeat(level)
    return `\n${prefix} ${getChildrenMarkdown(el, depth, insideTable, insideLink).trim()}\n`
  }

  // Handle Paragraphs & Divs
  if (tag === 'p') {
    return `\n${getChildrenMarkdown(el, depth, insideTable, insideLink).trim()}\n`
  }

  if (tag === 'blockquote') {
    const inner = getChildrenMarkdown(el, depth, insideTable, insideLink).trim()
    const lines = inner.split('\n').map((l) => `> ${l}`).join('\n')
    return `\n${lines}\n`
  }

  // Handle Strong / Bold
  if (tag === 'strong' || tag === 'b') {
    return `**${getChildrenMarkdown(el, depth, insideTable, insideLink)}**`
  }

  // Handle Emphasis / Italic
  if (tag === 'em' || tag === 'i') {
    return `*${getChildrenMarkdown(el, depth, insideTable, insideLink)}*`
  }

  // Handle Strikethrough
  if (tag === 'del' || tag === 's' || tag === 'strike') {
    return `~~${getChildrenMarkdown(el, depth, insideTable, insideLink)}~~`
  }

  // Handle Links：地址括号转义，链接文本内的 `]` 转义
  if (tag === 'a') {
    const href = escapeLinkUrl(el.getAttribute('href') || '')
    const text = getChildrenMarkdown(el, depth, insideTable, true)
    return `[${text}](${href})`
  }

  // Handle Images
  if (tag === 'img') {
    const src = escapeLinkUrl(el.getAttribute('src') || '')
    const alt = escapeText(el.getAttribute('alt') || '', true)
    return `![${alt}](${src})`
  }

  // Handle Lists（无序/有序/任务列表）：任务项同样按子节点序列化
  //（保留行内格式与嵌套结构），续行按标记宽度缩进保证层级语义不变
  if (tag === 'ul' || tag === 'ol') {
    const startAttr = Number.parseInt(el.getAttribute('start') || '', 10)
    const start = tag === 'ol' && !Number.isNaN(startAttr) ? startAttr : 1
    const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li')
    const md = items.map((li, idx) => {
      const task = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null
      const marker = task
        ? `- [${task.checked ? 'x' : ' '}] `
        : tag === 'ol'
          ? `${start + idx}. `
          : '- '
      const inner = getChildrenMarkdown(li, depth + 1, insideTable, insideLink).trim()
      const pad = ' '.repeat(marker.length)
      // 首行紧跟标记无需缩进，续行（嵌套列表等）按标记宽度缩进保持层级
      const indented = inner
        .split('\n')
        .map((line, i) => (i === 0 || !line ? line : pad + line))
        .join('\n')
      return marker + indented
    }).join('\n')
    return `\n${md}\n`
  }

  // Handle Tables
  if (tag === 'table') {
    if (insideTable) {
      // 嵌套表格降级为纯文本：GFM 单元格内无法承载块级表格，
      // 递归序列化会把内层行/分隔行混入外层，破坏列结构
      return el.textContent || ''
    }
    return `\n${serializeTable(el)}\n`
  }

  // Handle Horizontal Rule
  if (tag === 'hr') {
    return `\n---\n`
  }

  // Line breaks
  if (tag === 'br') {
    return '\n'
  }

  return getChildrenMarkdown(el, depth, insideTable, insideLink)
}

function getChildrenMarkdown(el: Node, depth: number, insideTable: boolean, insideLink: boolean = false): string {
  let res = ''
  el.childNodes.forEach((child) => {
    res += nodeToMarkdown(child, depth, insideTable, insideLink)
  })
  return res
}

function serializeTable(table: HTMLElement): string {
  // 行收集仅限当前表格的直接结构（thead/tbody/tfoot > tr 或无分节的 table > tr）；
  // 之前的 querySelectorAll('tr') 会把嵌套表格的行误并入外层
  const rows = Array.from(
    table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr')
  )
  if (rows.length === 0) return ''

  const tableData: string[][] = []
  rows.forEach((row) => {
    // 单趟按文档序收集本行直接子级的 th/td：先 th 后 td 的两趟收集会重排混排行
    const cells = Array.from(row.children).filter(
      (c) => c.tagName.toLowerCase() === 'th' || c.tagName.toLowerCase() === 'td'
    )
    tableData.push(cells.map((c) => (
      getChildrenMarkdown(c, 0, true)
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l)
        .join(' ')
        .replace(/\|/g, '\\|')
    )))
  })

  if (tableData.length === 0) return ''

  const maxCols = Math.max(...tableData.map((r) => r.length))
  const headerRow = tableData[0]
  while (headerRow.length < maxCols) headerRow.push('')

  const headerLine = `| ${headerRow.join(' | ')} |`
  const separatorLine = `| ${headerRow.map(() => '---').join(' | ')} |`

  const bodyLines = tableData.slice(1).map((row) => {
    while (row.length < maxCols) row.push('')
    return `| ${row.join(' | ')} |`
  })

  return [headerLine, separatorLine, ...bodyLines].join('\n')
}
