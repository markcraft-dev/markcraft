import type { OutlineItem } from '@/shared/types'
import { loadAnalyzer } from './wasm_analyzer'

interface HeadingSnapshot {
  text: string
  level: number
}

const INVALID_CHARS = /[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc}\- ]/gu

/** JS 回退实现：与 WASM 版 slug 规则一致。 */
function generateSlug(text: string, counters: Record<string, number>): string {
  const base = encodeURIComponent(
    text.toLowerCase().replace(/ /g, '-').replace(INVALID_CHARS, '').trim()
  )
  if (base in counters) {
    return `${base}-${counters[base]++}`
  }
  counters[base] = 1
  return base
}

function buildOutlineFallback(
  headings: HTMLElement[],
  maxLevel: number
): { tree: OutlineItem[]; list: OutlineItem[] } {
  const flatResult: OutlineItem[] = []
  const treeResult: OutlineItem[] = []
  const stack: OutlineItem[] = []
  const counters: Record<string, number> = {}

  headings.forEach((heading, idx) => {
    const text = (heading.textContent || '').trim()
    const slug = generateSlug(text, counters)

    const level = Number.parseInt(heading.tagName.slice(1), 10)
    const item: OutlineItem = {
      id: idx,
      parentId: null,
      href: `#${slug}`,
      content: text,
      level,
      active: false,
      expanded: level <= maxLevel
    }

    flatResult.push(item)

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    if (stack.length === 0) {
      treeResult.push(item)
    } else {
      const parent = stack[stack.length - 1]
      parent.children = parent.children || []
      item.parentId = parent.id
      parent.children.push(item)
    }

    stack.push(item)
  })

  return { tree: treeResult, list: flatResult }
}

/**
 * 提取文章大纲：slug 生成、去重与树构建位于 Rust；
 * JS 负责读取标题元素，并把生成的 slug 写回对应 id 属性。
 */
export async function extractOutline(
  container: HTMLElement,
  maxLevel = 6
): Promise<{ tree: OutlineItem[]; list: OutlineItem[] }> {
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
  let result: { tree: OutlineItem[]; list: OutlineItem[] } | null = null

  const analyzer = await loadAnalyzer()
  if (analyzer) {
    try {
      const snapshots: HeadingSnapshot[] = headings.map((heading) => ({
        text: (heading.textContent || '').trim(),
        level: Number.parseInt(heading.tagName.slice(1), 10)
      }))
      const raw = analyzer.build_outline(snapshots, maxLevel) as
        | { tree?: unknown; list?: unknown }
        | null
      if (raw && Array.isArray(raw.tree) && Array.isArray(raw.list)) {
        result = { tree: raw.tree as OutlineItem[], list: raw.list as OutlineItem[] }
      }
    } catch {
      // 回退到 JS 实现
    }
  }

  if (!result) {
    result = buildOutlineFallback(headings, maxLevel)
  }

  // 按文档顺序把 slug 写回标题元素（原实现的 setAttribute('id') 职责）
  result.list.forEach((item, idx) => {
    headings[idx]?.setAttribute('id', item.href.slice(1))
  })

  return result
}
