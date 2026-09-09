import type { TreeNodeItem } from '@/shared/types'

const MD_EXTENSIONS = ['.md', '.mkd', '.markdown', '.txt', '.mdx', '.mdc']

// 同一目录在筛选、展开和返回上级导航时可能被重复读取；缓存本次页面会话内的响应，避免重复网络往返。
const DIRECTORY_CACHE_TTL_MS = 30_000
const directoryHtmlCache = new Map<string, { expiresAt: number; request: Promise<string> }>()

function fetchDirectoryHtml(url: string): Promise<string> {
  const normalizedUrl = url.endsWith('/') ? url : `${url}/`
  const cached = directoryHtmlCache.get(normalizedUrl)
  if (cached && cached.expiresAt > Date.now()) return cached.request

  const request = new Promise<string>((resolve) => {
    chrome.runtime.sendMessage({ type: 'bg-fetch', url: normalizedUrl }, (res) => {
      resolve(res?.ok ? res.res || '' : '')
    })
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
  if (!targetFileUrl.startsWith(rootUrl)) return ancestors

  const relative = targetFileUrl.substring(rootUrl.length)
  const segments = relative.split('/').filter(Boolean)
  // Remove last segment (filename)
  segments.pop()

  let current = rootUrl.endsWith('/') ? rootUrl : `${rootUrl}/`
  for (const seg of segments) {
    current = `${current}${seg}/`
    ancestors.push(current)
  }

  return ancestors
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

    const rowRegex = /addRow\("(.*?)",\s*"(.*?)",\s*(\d+),\s*(\d+),\s*"([\d.]+ [BkMG]B?)",\s*(\d+),\s*"(.*?)"\);/g
    let match: RegExpExecArray | null
    const subfolders: string[] = []

    while ((match = rowRegex.exec(html)) !== null) {
      const name = match[1]
      const isFolder = !!Number.parseInt(match[3])
      const lowerName = (name || '').toLowerCase()

      if (!isFolder && MD_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        return true
      }

      if (isFolder && !name.startsWith('.')) {
        subfolders.push(`${url}${match[2]}`)
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

  const rowRegex = /addRow\("(.*?)",\s*"(.*?)",\s*(\d+),\s*(\d+),\s*"([\d.]+ [BkMG]B?)",\s*(\d+),\s*"(.*?)"\);/g
  const rawItems: any[] = []
  let match: RegExpExecArray | null

  while ((match = rowRegex.exec(html)) !== null) {
    const name = match[1]
    const isFolder = !!Number.parseInt(match[3])
    const lowerName = (name || '').toLowerCase()

    if (name.startsWith('.')) {
      continue
    }

    if (!isFolder && !MD_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      continue
    }

    rawItems.push({
      name,
      path: match[2],
      isFolder,
      size: Number.parseInt(match[4]),
      sizeUnit: match[5],
      timestamp: Number.parseInt(match[6]),
      date: new Date(match[7]),
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
