import type { TreeNodeItem } from '@/shared/types'
import { loadAnalyzer } from './wasm_analyzer'
import { parseDirectory, type ParsedDirectoryItem } from './wasm_directory'

const MD_EXTENSIONS = ['.md', '.mkd', '.markdown', '.txt', '.mdx', '.mdc']

// 同一目录在筛选、展开和返回上级导航时可能被重复读取；缓存本次页面会话内的响应，避免重复网络往返。
const DIRECTORY_CACHE_TTL_MS = 30_000
const directoryHtmlCache = new Map<string, { expiresAt: number; request: Promise<string> }>()

// 目录读取失败状态：用于区分「空目录」与「读取失败」（如未开启文件访问权限）
let directoryReadFailed = false
let accessGuidanceShown = false

/** 本会话内是否发生过本地目录读取失败（供 UI 区分空目录与失败状态）。 */
export function hasDirectoryReadFailure(): boolean {
  return directoryReadFailed
}

function handleDirectoryReadFailure(): void {
  directoryReadFailed = true
  if (accessGuidanceShown) return
  accessGuidanceShown = true
  // 最常见原因是扩展未开启「允许访问文件网址」；给出引导而非静默剪掉子目录
  console.warn(
    '[MarkCraft] 本地目录读取失败：请在 chrome://extensions → MarkCraft 详情页开启「允许访问文件网址」。' +
      '未开启时子目录会显示为空。'
  )
}

function fetchDirectoryHtml(url: string): Promise<string> {
  const normalizedUrl = url.endsWith('/') ? url : `${url}/`
  const cached = directoryHtmlCache.get(normalizedUrl)
  if (cached && cached.expiresAt > Date.now()) return cached.request

  const request = new Promise<string>((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'bg-fetch', url: normalizedUrl }, (res) => {
        // 读取并吞噬 lastError，避免未处理异常
        void chrome.runtime.lastError
        if (res?.ok) {
          directoryReadFailed = false
          resolve(res.res || '')
        } else {
          handleDirectoryReadFailure()
          resolve('')
        }
      })
    } catch {
      // 扩展上下文失效等同步异常按读取失败处理，不让 Promise 变成 unhandledrejection
      handleDirectoryReadFailure()
      resolve('')
    }
  })
  directoryHtmlCache.set(normalizedUrl, { expiresAt: Date.now() + DIRECTORY_CACHE_TTL_MS, request })
  request.then((html) => {
    if (!html) directoryHtmlCache.delete(normalizedUrl)
  })
  return request
}

export function getParentFolderURL(currentUrl?: string): string {
  const target = currentUrl || window.location.href
  if (target.endsWith('/')) {
    return target
  }
  const lastSlashIndex = target.lastIndexOf('/')
  return lastSlashIndex !== -1 ? `${target.substring(0, lastSlashIndex + 1)}` : `${target}/`
}

/**
 * Get all ancestor folder URLs from a root down to a target file URL
 */
export function getAncestorFolderURLs(rootUrl: string, targetFileUrl: string): string[] {
  const ancestors: string[] = []
  // 前缀判断使用补齐尾斜杠后的根 URL，避免 /root 误匹配 /root2 下的文件
  const root = rootUrl.endsWith('/') ? rootUrl : `${rootUrl}/`
  if (!targetFileUrl.startsWith(root)) return ancestors

  const relative = targetFileUrl.substring(root.length)
  const segments = relative.split('/').filter(Boolean)
  // Remove last segment (filename)
  segments.pop()

  let current = root
  for (const seg of segments) {
    current = `${current}${seg}/`
    ancestors.push(current)
  }

  return ancestors
}

/**
 * 祖先目录推导优先走 WASM，失败时回退到上方等价 JS 实现。
 */
export async function resolveAncestorFolderURLs(rootUrl: string, targetFileUrl: string): Promise<string[]> {
  const analyzer = await loadAnalyzer()
  if (analyzer) {
    try {
      const urls = analyzer.ancestor_folder_urls(rootUrl, targetFileUrl)
      if (Array.isArray(urls)) return urls as string[]
    } catch {
      // 回退到 JS 实现
    }
  }
  return getAncestorFolderURLs(rootUrl, targetFileUrl)
}

/**
 * 解析目录 HTML 中的条目：优先走 WASM 过滤（隐藏文件 / 非 Markdown 规则在 Rust 端），
 * 失败时回退到 parseDirectory + 本地过滤。
 */
async function parseDirectoryItems(html: string): Promise<ParsedDirectoryItem[]> {
  const analyzer = await loadAnalyzer()
  if (analyzer) {
    try {
      const filtered = analyzer.filter_directory(html)
      if (Array.isArray(filtered)) return filtered as ParsedDirectoryItem[]
    } catch {
      // 回退到 JS 实现
    }
  }

  return (await parseDirectory(html)).filter((item) => {
    if (item.name.startsWith('.')) return false
    if (item.is_folder) return true
    const lowerName = (item.name || '').toLowerCase()
    return MD_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  })
}

/**
 * Check if a folder directly or indirectly contains Markdown files
 */
async function hasMarkdownContent(folderUrl: string, depth = 0): Promise<boolean> {
  if (depth > 2) return true // safeguard max depth
  const url = folderUrl.endsWith('/') ? folderUrl : `${folderUrl}/`

  try {
    const html = await fetchDirectoryHtml(url)
    if (!html) return false

    // 单页扫描（Markdown 判定与子目录收集）优先走 WASM
    const analyzer = await loadAnalyzer()
    if (analyzer) {
      try {
        const scan = analyzer.scan_directory(html, url) as
          | { has_markdown?: boolean; subfolders?: string[] }
          | null
        if (scan && typeof scan.has_markdown === 'boolean' && Array.isArray(scan.subfolders)) {
          if (scan.has_markdown) return true
          const subfolders = scan.subfolders
          if (subfolders.length > 0) {
            const results = await Promise.all(subfolders.map((sub) => hasMarkdownContent(sub, depth + 1)))
            return results.some(Boolean)
          }
          return false
        }
      } catch {
        // 回退到 JS 实现
      }
    }

    const subfolders: string[] = []

    for (const item of await parseDirectory(html)) {
      const name = item.name
      const isFolder = item.is_folder
      const lowerName = (name || '').toLowerCase()

      if (!isFolder && MD_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        return true
      }

      if (isFolder && !name.startsWith('.')) {
        subfolders.push(`${url}${item.path}`)
      }
    }

    if (subfolders.length > 0) {
      const results = await Promise.all(subfolders.map((sub) => hasMarkdownContent(sub, depth + 1)))
      return results.some(Boolean)
    }

    return false
  } catch {
    return false
  }
}

export async function fetchDirectory(
  dirUrl?: string,
  expandedSet?: Set<string>,
  activeHref?: string
): Promise<TreeNodeItem[]> {
  const url = dirUrl ? (dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`) : getParentFolderURL()
  let html = ''

  try {
    html = await fetchDirectoryHtml(url)
  } catch (e) {
    console.error('[MarkCraft] Failed to fetch directory:', e)
    return []
  }

  if (!html && window.location.pathname.endsWith('/')) {
    html = document.body.outerHTML
  }

  if (!html) {
    return []
  }

  const rawItems: any[] = []
  for (const item of await parseDirectoryItems(html)) {
    const name = item.name
    const isFolder = item.is_folder
    const lowerName = (name || '').toLowerCase()

    if (name.startsWith('.')) {
      continue
    }

    if (!isFolder && !MD_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      continue
    }

    rawItems.push({
      name,
      path: item.path,
      isFolder,
      size: item.size,
      sizeUnit: item.size_unit,
      timestamp: item.timestamp,
      date: new Date(item.date),
      parentPath: url
    })
  }

  const checkedItems = await Promise.all(
    rawItems.map(async (item) => {
      if (item.isFolder) {
        const containsMd = await hasMarkdownContent(`${item.parentPath}${item.path}`)
        return containsMd ? item : null
      }
      return item
    })
  )

  const validItems = checkedItems.filter(Boolean)
  const currentHref = activeHref || window.location.href
  const nodes = mapToTreeNodes(validItems, currentHref)

  // Recursively expand nodes in expandedSet
  if (expandedSet && expandedSet.size > 0) {
    await Promise.all(
      nodes.map(async (node) => {
        const folderUrl = node.href.endsWith('/') ? node.href : `${node.href}/`
        if (node.isFolder && (expandedSet.has(node.href) || expandedSet.has(folderUrl))) {
          node.expanded = true
          node.children = await fetchDirectory(node.href, expandedSet, currentHref)
        }
      })
    )
  }

  return nodes
}

export function mapToTreeNodes(items: any[], activeHref?: string): TreeNodeItem[] {
  return items.map((item, idx) => {
    const name = String(item.name).trim()
    const href = `${item.parentPath}${item.path}`
    return {
      id: idx,
      content: name,
      isFolder: item.isFolder,
      href,
      size: item.size,
      sizeUnit: item.sizeUnit,
      modifiedDate: item.timestamp,
      date: item.date,
      active: activeHref ? href === activeHref : false,
      expanded: false,
      leafExpandable: item.isFolder,
      isHiddenFile: name.startsWith('.'),
      parentPath: item.parentPath
    }
  })
}
