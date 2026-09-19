/**
 * Document-URL synchronization (Bug3 fix).
 *
 * Problem: switching documents via the sidebar / palette loads the new
 * markdown in place, but the address bar was only updated by scattered
 * `history.pushState(fullFileUrl)` calls. On `file://` pages the document
 * has an opaque origin (`null`), so a path-changing pushState throws a
 * SecurityError that was swallowed — the address bar stayed stale and a
 * reload reopened the old document.
 *
 * Contract (see App.vue `switchToDocument`):
 * - Every in-place document switch ends with `syncDocUrl(href)`.
 * - `syncDocUrl` first tries a full-URL pushState (works on http(s) and some
 *   file:// configurations: refresh / paste / share then work natively).
 *   When that throws, it falls back to a same-document hash route
 *   `#mdr-doc=<encoded-doc-url>` on the real page file, which is always
 *   allowed and is resolved back on load / traversal.
 * - `parseDocUrl` extracts the pointer (`?mdr-doc=` or `#mdr-doc=`); plain
 *   heading anchors (`#some-heading`) are never treated as doc pointers.
 * - Loading order is always doc-first: resolve the document, render it, sync
 *   the URL, and only then restore scroll (see scroll-memory.ts).
 */

export const DOC_QUERY_PARAM = 'mdr-doc'
const DOC_HASH_PREFIX = '#mdr-doc='

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.mkd', '.mdc'])

export interface ParsedDocUrl {
  /** Absolute URL of the pointed-to document, or null when the URL carries no valid pointer. */
  docHref: string | null
  /** Heading anchor (with leading `#`), or null. */
  anchor: string | null
}

export interface DocSwitchUrlOptions {
  /** Use replaceState instead of pushState (initial resolution, no new entry). */
  replace?: boolean
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function toAbsoluteDocHref(candidate: string, base: string): string | null {
  if (!candidate) return null
  try {
    return new URL(candidate, base).href
  } catch {
    return null
  }
}

/** A doc pointer must be a fetchable markdown file, never a directory listing. */
export function isMarkdownDocHref(href: string): boolean {
  try {
    const url = new URL(href)
    if (url.protocol !== 'file:' && url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const cleanPath = url.pathname.split('?')[0].split('#')[0].toLowerCase()
    if (cleanPath.endsWith('/')) return false
    const lastDot = cleanPath.lastIndexOf('.')
    if (lastDot === -1) return false
    return MARKDOWN_EXTENSIONS.has(cleanPath.slice(lastDot))
  } catch {
    return false
  }
}

/**
 * Extract a document pointer + optional heading anchor from a URL.
 * Query form (`?mdr-doc=<url>#<anchor>`) wins over hash form
 * (`#mdr-doc=<url>&a=<anchor>`); anything else is anchor-only.
 */
export function parseDocUrl(url: string): ParsedDocUrl {
  try {
    const parsed = new URL(url, window.location.href)
    const queryDoc = parsed.searchParams.get(DOC_QUERY_PARAM)
    if (queryDoc) {
      const resolved = toAbsoluteDocHref(safeDecode(queryDoc), url)
      const anchor = parsed.hash && !parsed.hash.startsWith(DOC_HASH_PREFIX) ? parsed.hash : null
      return { docHref: resolved && isMarkdownDocHref(resolved) ? resolved : null, anchor }
    }
    if (parsed.hash.startsWith(DOC_HASH_PREFIX)) {
      const rest = parsed.hash.slice(DOC_HASH_PREFIX.length)
      const ampIndex = rest.indexOf('&a=')
      const docPart = ampIndex === -1 ? rest : rest.slice(0, ampIndex)
      const anchorPart = ampIndex === -1 ? '' : rest.slice(ampIndex + 3)
      const resolved = toAbsoluteDocHref(safeDecode(docPart), url)
      const anchor = anchorPart ? `#${safeDecode(anchorPart).replace(/^#+/, '')}` : null
      return { docHref: resolved && isMarkdownDocHref(resolved) ? resolved : null, anchor }
    }
    return { docHref: null, anchor: parsed.hash || null }
  } catch {
    return { docHref: null, anchor: null }
  }
}

/** Strip our own pointer (query param + hash route) to recover the real page file URL. */
export function stripDocPointer(url: string): string {
  try {
    const parsed = new URL(url, window.location.href)
    parsed.searchParams.delete(DOC_QUERY_PARAM)
    if (parsed.hash.startsWith(DOC_HASH_PREFIX)) parsed.hash = ''
    return parsed.href
  } catch {
    return url.split('#')[0]
  }
}

/** Same-document comparison ignoring fragments (scroll keys use the same rule). */
export function isSameDocument(a: string, b: string): boolean {
  try {
    return stripDocPointer(a).split('#')[0] === stripDocPointer(b).split('#')[0]
  } catch {
    return a === b
  }
}

/**
 * Record an in-place document switch in history. Full-URL first, hash-route
 * fallback for file:// opaque origins. Never throws; returns the effective URL.
 */
export function syncDocUrl(href: string, opts?: DocSwitchUrlOptions): string {
  const method = opts?.replace ? 'replaceState' : 'pushState'
  try {
    history[method]({ mdrHref: href }, '', href)
    return href
  } catch (e) {
    console.warn(`[MarkCraft] full-URL history sync failed (${method} → ${href}); falling back to hash route:`, e)
  }
  try {
    const base = stripDocPointer(window.location.href).split('#')[0]
    const next = `${base}${DOC_HASH_PREFIX}${encodeURIComponent(href)}`
    history[method]({ mdrHref: href }, '', next)
    return next
  } catch (e) {
    console.warn('[MarkCraft] hash history sync failed; address bar will stay stale:', e)
    try {
      document.title = safeDecode(href.split('/').pop() || '') || document.title
    } catch {
      // Title fallback is best-effort only.
    }
    return window.location.href
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Single-file fetch urgency matches the directory path (folder.ts): a cold
// background worker rejects the first message, so retry briefly instead of
// dropping to a full navigation on the first failure.
const DOC_FETCH_MAX_ATTEMPTS = 3
const DOC_FETCH_RETRY_DELAYS_MS = [250, 800]

/**
 * Fetch a document's raw markdown through the background worker.
 * Returns null when every attempt fails (caller falls back to navigation).
 */
export function fetchDocContent(href: string): Promise<string | null> {
  return (async (): Promise<string | null> => {
    let lastMsg = ''
    for (let attempt = 1; attempt <= DOC_FETCH_MAX_ATTEMPTS; attempt += 1) {
      const res = await new Promise<{ ok?: boolean; res?: string; msg?: string }>((resolve) => {
        try {
          chrome.runtime.sendMessage({ type: 'bg-fetch', url: href }, (r) => {
            const lastErrorMsg = chrome.runtime.lastError?.message || ''
            if (lastErrorMsg) {
              resolve({ ok: false, msg: lastErrorMsg })
              return
            }
            resolve(r || { ok: false, msg: 'empty bg-fetch response' })
          })
        } catch (e) {
          resolve({ ok: false, msg: e instanceof Error ? e.message : String(e) })
        }
      })
      if (res?.ok && res.res !== undefined) return res.res
      lastMsg = res?.msg || ''
      if (attempt < DOC_FETCH_MAX_ATTEMPTS) {
        console.warn(
          `[MarkCraft] doc fetch failed (attempt ${attempt}/${DOC_FETCH_MAX_ATTEMPTS}) for ${href}: ${lastMsg || 'unknown error'} — retrying`
        )
        await sleep(DOC_FETCH_RETRY_DELAYS_MS[attempt - 1] ?? 500)
      }
    }
    console.error(`[MarkCraft] doc fetch gave up after ${DOC_FETCH_MAX_ATTEMPTS} attempts: ${href} (${lastMsg || 'unknown error'})`)
    return null
  })()
}
