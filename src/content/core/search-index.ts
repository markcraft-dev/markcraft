// 文件夹全文检索 JS 封装（R7）：Rust WASM 倒排索引优先，WASM 不可用时
// 走下方等价 JS 回退。内容一律经 bg-fetch（`fetchDocContent`）获取，
// 满足 file:// 友好要求；单文件截断 200KB（R7 风险注记），防索引内存爆炸。
import type { TreeNodeItem } from '@/shared/types'
import { loadAnalyzer } from './wasm_analyzer'
import { fetchDocContent } from './doc-url'

export interface FulltextHit {
  href: string
  title: string
  snippet: string
  /** 摘要内的命中区间（字符下标 [start, end)），供转义后包 <mark> */
  highlights: Array<[number, number]>
  score: number
}

export type FulltextState = 'idle' | 'indexing' | 'ready' | 'empty' | 'unsupported'

export interface FulltextStatus {
  state: FulltextState
  /** 工作区文件总数 */
  total: number
  /** 已收录进索引的文档数 */
  indexed: number
}

/** 单文件送入索引前的截断（字符数）：真实文档远小于此值，防超大文件撑爆内存。 */
export const FULLTEXT_MAX_CHARS_PER_DOC = 200_000
/** 全文 tab 默认返回条数（与 Rust DEFAULT_LIMIT 对齐）。 */
export const FULLTEXT_LIMIT = 20
/** 正文拉取并发：太高会冲垮冷启动的 background worker，太低则 200 文件太慢。 */
const FETCH_CONCURRENCY = 6
/** 搜索防抖由调用方（palette）负责；此处仅记录单次检索耗时供验收观察。 */

interface IndexedDoc {
  href: string
  title: string
  body: string
}

const TITLE_WEIGHT = 5
const BODY_WEIGHT = 1
const SNIPPET_RADIUS = 60

function isCjk(code: number): boolean {
  return (
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff)
  )
}

function isLatinToken(token: string): boolean {
  return token.length > 0 && /^[a-z0-9]+$/.test(token)
}

/** 分词（与 Rust `tokenize` 同规则）：CJK 按字，拉丁/数字按连续串，全小写。 */
export function tokenizeFulltext(text: string): string[] {
  const tokens: string[] = []
  let latin = ''
  const lower = text.toLowerCase()
  for (const ch of lower) {
    const code = ch.codePointAt(0) ?? 0
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      latin += ch
      continue
    }
    if (latin) {
      tokens.push(latin)
      latin = ''
    }
    if (isCjk(code)) tokens.push(ch)
  }
  if (latin) tokens.push(latin)
  return tokens
}

function tokenizeWithSpans(text: string): Array<[string, number, number]> {
  const spans: Array<[string, number, number]> = []
  let latin = ''
  let latinStart = 0
  let idx = 0
  for (const ch of text.toLowerCase()) {
    const code = ch.codePointAt(0) ?? 0
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      if (!latin) latinStart = idx
      latin += ch
    } else {
      if (latin) {
        spans.push([latin, latinStart, idx])
        latin = ''
      }
      if (isCjk(code)) spans.push([ch, idx, idx + 1])
    }
    idx += 1
  }
  if (latin) spans.push([latin, latinStart, idx])
  return spans
}

// ---------- JS 回退索引（与 Rust 同算法，WASM 不可用时启用） ----------

interface FallbackPosting {
  doc: number
  title: number
  body: number
}

let fallbackDocs: IndexedDoc[] = []
let fallbackPostings = new Map<string, FallbackPosting[]>()

function fallbackBuild(docs: IndexedDoc[]): void {
  fallbackDocs = docs
  fallbackPostings = new Map()
  docs.forEach((doc, docIdx) => {
    const titleCounts = new Map<string, number>()
    for (const t of tokenizeFulltext(doc.title)) titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1)
    const bodyCounts = new Map<string, number>()
    for (const t of tokenizeFulltext(doc.body)) bodyCounts.set(t, (bodyCounts.get(t) ?? 0) + 1)
    for (const [token, count] of titleCounts) {
      const list = fallbackPostings.get(token) ?? []
      list.push({ doc: docIdx, title: count, body: 0 })
      fallbackPostings.set(token, list)
    }
    for (const [token, count] of bodyCounts) {
      const list = fallbackPostings.get(token)
      const hit = list?.find((p) => p.doc === docIdx)
      if (hit) hit.body = count
      else fallbackPostings.set(token, [...(list ?? []), { doc: docIdx, title: 0, body: count }])
    }
  })
}

function fallbackMatchSpans(docIdx: number, queryTokens: string[]): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  for (const [token, s, e] of tokenizeWithSpans(fallbackDocs[docIdx].body)) {
    for (const q of queryTokens) {
      if (token === q || (isLatinToken(q) && token.startsWith(q))) {
        spans.push([s, e])
        break
      }
    }
  }
  return spans.sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

function fallbackSnippet(docIdx: number, queryTokens: string[]): { snippet: string; highlights: Array<[number, number]> } {
  const chars = Array.from(fallbackDocs[docIdx].body)
  if (chars.length === 0) return { snippet: '', highlights: [] }
  const spans = fallbackMatchSpans(docIdx, queryTokens)
  if (spans.length === 0) {
    return { snippet: chars.slice(0, SNIPPET_RADIUS).join(''), highlights: [] }
  }
  const winStart = Math.max(0, spans[0][0] - SNIPPET_RADIUS)
  const winEnd = Math.min(chars.length, spans[0][0] + SNIPPET_RADIUS)
  const highlights: Array<[number, number]> = []
  for (const [s, e] of spans) {
    if (e <= winStart || s >= winEnd) continue
    highlights.push([Math.max(s, winStart) - winStart, Math.min(e, winEnd) - winStart])
  }
  return { snippet: chars.slice(winStart, winEnd).join(''), highlights }
}

function fallbackSearch(query: string, limit: number): FulltextHit[] {
  const tokens = tokenizeFulltext(query)
  if (tokens.length === 0) return []
  const unique = [...new Set(tokens)]
  const scores = new Map<number, number>()
  const add = (q: string, onlyLonger: boolean) => {
    for (const [token, list] of fallbackPostings) {
      const exact = token === q
      if (!exact && !(onlyLonger && isLatinToken(q) && token.length > q.length && token.startsWith(q))) {
        continue
      }
      if (exact && onlyLonger) continue
      for (const p of list) {
        scores.set(p.doc, (scores.get(p.doc) ?? 0) + p.title * TITLE_WEIGHT + p.body * BODY_WEIGHT)
      }
    }
  }
  for (const q of unique) {
    add(q, false)
    if (isLatinToken(q)) add(q, true)
  }
  return [...scores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || fallbackDocs[a[0]].href.localeCompare(fallbackDocs[b[0]].href))
    .slice(0, Math.min(Math.max(1, limit), 50))
    .map(([docIdx, score]) => {
      const { snippet, highlights } = fallbackSnippet(docIdx, tokens)
      return { href: fallbackDocs[docIdx].href, title: fallbackDocs[docIdx].title, snippet, highlights, score }
    })
}

// ---------- 摘要转义 + 高亮（R0 兼容的安全构造） ----------

/**
 * 摘要 HTML 渲染：按字符区间逐段转义后再包 `<mark>`。
 * 输出只含转义文本与 `<mark>` 标签，不含任何原文 HTML——
 * R0 `sanitize.ts` 落地后可再包一层，当前已是安全构造。
 */
export function renderSnippetHtml(snippet: string, highlights: Array<[number, number]>): string {
  const chars = Array.from(snippet)
  const escape = (s: string): string =>
    s.replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch
    ))
  const ranges = [...highlights]
    .filter(([s, e]) => Number.isInteger(s) && Number.isInteger(e) && s < e)
    .map(([s, e]) => [Math.max(0, s), Math.min(chars.length, e)] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let html = ''
  let cursor = 0
  for (const [s, e] of ranges) {
    if (s < cursor) continue // 重叠区间跳过，避免 <mark> 嵌套
    html += escape(chars.slice(cursor, s).join(''))
    html += `<mark class="mdr-ft-mark">${escape(chars.slice(s, e).join(''))}</mark>`
    cursor = e
  }
  html += escape(chars.slice(cursor).join(''))
  return html
}

// ---------- 索引编排（抓取 → 建索引 → 查询） ----------

let cachedSignature = ''
let cachedDocs: IndexedDoc[] = []
let cachedTotal = 0
let cachedIndexed = 0
let indexState: FulltextState = 'idle'
let indexFlight: Promise<FulltextStatus> | null = null
let wasmAvailable: boolean | null = null

export function isFulltextSupported(): boolean {
  return window.location.protocol === 'file:'
}

export function getFulltextStatus(): FulltextStatus {
  return { state: indexState, total: cachedTotal, indexed: cachedIndexed }
}

function flattenFileEntries(nodes: TreeNodeItem[]): Array<{ href: string; title: string }> {
  const out: Array<{ href: string; title: string }> = []
  const seen = new Set<string>()
  const walk = (items: TreeNodeItem[]): void => {
    for (const item of items) {
      if (item.isFolder) {
        if (item.children) walk(item.children)
        continue
      }
      if (item.href && !seen.has(item.href)) {
        seen.add(item.href)
        out.push({ href: item.href, title: item.content || item.href.split('/').pop() || 'Markdown' })
      }
    }
  }
  walk(nodes)
  return out
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (cursor < items.length) {
      const idx = cursor
      cursor += 1
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * 确保全文索引就绪：工作区签名不变则直接复用；否则经 bg-fetch 拉取正文
 * （WASM 常驻索引优先，不可用则 JS 回退索引）。并发单 flight，重复调用复用。
 */
export function ensureFulltextIndex(files: TreeNodeItem[]): Promise<FulltextStatus> {
  if (!isFulltextSupported()) {
    indexState = 'unsupported'
    return Promise.resolve(getFulltextStatus())
  }
  const entries = flattenFileEntries(files)
  cachedTotal = entries.length
  if (entries.length === 0) {
    indexState = 'empty'
    return Promise.resolve(getFulltextStatus())
  }
  const signature = entries.map((e) => e.href).sort().join('\n')
  if (signature === cachedSignature && indexState === 'ready') {
    return Promise.resolve(getFulltextStatus())
  }
  if (indexFlight) return indexFlight
  indexState = 'indexing'
  cachedIndexed = 0
  indexFlight = (async (): Promise<FulltextStatus> => {
    try {
      const bodies = await mapPool(entries, FETCH_CONCURRENCY, async (entry) => {
        const text = await fetchDocContent(entry.href)
        cachedIndexed += 1
        return text ?? ''
      })
      const docs: IndexedDoc[] = entries.map((entry, i) => ({
        href: entry.href,
        title: entry.title,
        body: bodies[i].slice(0, FULLTEXT_MAX_CHARS_PER_DOC)
      }))
      let built: number | null = null
      try {
        const analyzer = await loadAnalyzer()
        if (analyzer && typeof analyzer.fulltext_index_build === 'function') {
          const count = analyzer.fulltext_index_build(docs)
          if (typeof count === 'number') {
            built = count
            wasmAvailable = true
          }
        }
      } catch {
        // 掉入 JS 回退
      }
      if (built === null) {
        wasmAvailable = false
        fallbackBuild(docs)
        built = docs.length
      }
      cachedDocs = docs
      cachedSignature = signature
      cachedIndexed = built
      indexState = 'ready'
      return getFulltextStatus()
    } catch (e) {
      console.warn('[MarkCraft] fulltext index build failed:', e)
      cachedSignature = ''
      indexState = 'idle'
      return getFulltextStatus()
    } finally {
      indexFlight = null
    }
  })()
  return indexFlight
}

export interface FulltextSearchResult {
  hits: FulltextHit[]
  /** 单次检索耗时（ms，索引查询本身，不含抓取建索引） */
  elapsedMs: number
  /** 是否走了 WASM（false = JS 回退） */
  viaWasm: boolean
}

/** 全文检索：索引未就绪时返回空命中（调用方先 `ensureFulltextIndex`）。 */
export async function searchFulltext(query: string, limit = FULLTEXT_LIMIT): Promise<FulltextSearchResult> {
  const started = performance.now()
  if (indexState !== 'ready' || !query.trim()) {
    return { hits: [], elapsedMs: 0, viaWasm: wasmAvailable === true }
  }
  if (wasmAvailable) {
    try {
      const analyzer = await loadAnalyzer()
      const raw = analyzer!.fulltext_search(query, limit)
      if (Array.isArray(raw)) {
        return {
          hits: raw as FulltextHit[],
          elapsedMs: performance.now() - started,
          viaWasm: true
        }
      }
    } catch {
      // 掉入 JS 回退
    }
  }
  return { hits: fallbackSearch(query, limit), elapsedMs: performance.now() - started, viaWasm: false }
}

/** 测试/调试用：清空缓存索引（不碰 WASM 常驻态，下次 ensure 重建）。 */
export function resetFulltextIndexForTest(): void {
  cachedSignature = ''
  cachedDocs = []
  cachedTotal = 0
  cachedIndexed = 0
  indexState = 'idle'
  indexFlight = null
  wasmAvailable = null
  fallbackBuild([])
}

export function getCachedFulltextDocs(): IndexedDoc[] {
  return cachedDocs
}
