// 快捷搜索面板的条目汇总与过滤：核心规则位于 Rust（search_palette），
// WASM 不可用时回退到下方等价 JS 实现。
import type { OutlineItem, TreeNodeItem } from '@/shared/types'
import { loadAnalyzer } from './wasm_analyzer'

export interface PaletteItem {
  id: string | number
  title: string
  href: string
  subPath?: string
  isHeading?: boolean
  /** 全文命中摘要 HTML（转义文本 + <mark>，见 search-index.renderSnippetHtml） */
  snippetHtml?: string
}

// 与 Rust 端常量保持一致：空查询推荐 12 条，关键词过滤后最多 16 条
const EMPTY_QUERY_LIMIT = 12
const FILTERED_LIMIT = 16

function flattenTreeFallback(nodes: TreeNodeItem[], path = '', result: PaletteItem[] = []): PaletteItem[] {
  for (const item of nodes) {
    if (item.isFolder && item.children) {
      flattenTreeFallback(item.children, `${path}${item.content}/`, result)
    } else if (!item.isFolder) {
      result.push({
        id: item.href,
        title: item.content,
        href: item.href,
        subPath: path.replace(/\/$/, '')
      })
    }
  }
  return result
}

function searchPaletteFallback(files: TreeNodeItem[], headings: OutlineItem[], query: string): PaletteItem[] {
  const fileItems = flattenTreeFallback(files)
  const headingItems: PaletteItem[] = (headings || []).map((h) => ({
    id: h.id,
    title: h.content,
    href: h.href,
    subPath: `文章大纲 H${h.level} 章节`,
    isHeading: true
  }))
  const allItems = [...fileItems, ...headingItems]

  const q = query.trim().toLowerCase()
  if (!q) {
    return allItems.slice(0, EMPTY_QUERY_LIMIT)
  }
  return allItems
    .filter((i) => i.title.toLowerCase().includes(q) || (i.subPath && i.subPath.toLowerCase().includes(q)))
    .slice(0, FILTERED_LIMIT)
}

export async function searchPalette(
  files: TreeNodeItem[],
  headings: OutlineItem[],
  query: string
): Promise<PaletteItem[]> {
  const analyzer = await loadAnalyzer()
  if (analyzer) {
    try {
      const result = analyzer.search_palette(files, headings, query)
      if (Array.isArray(result)) return result as PaletteItem[]
    } catch {
      // 回退到 JS 实现
    }
  }
  return searchPaletteFallback(files, headings, query)
}
