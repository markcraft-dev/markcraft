/**
 * Per-document scroll isolation + restore (Bug1 fix).
 *
 * Problem: switching documents via the sidebar / command palette loads the new
 * markdown in place (bg-fetch + history.pushState, no navigation), so the
 * window keeps document A's scroll offset. Opening an unread document B then
 * starts at the bottom instead of the top, and returning to A loses its place.
 *
 * This module stores one vertical scroll offset per document, keyed by the
 * document URL (hash stripped). Positions are kept in an in-memory map for
 * synchronous read/write during fast doc switches, mirrored to
 * chrome.storage.local (survives reloads, shared across tabs) with a
 * localStorage fallback for contexts without the chrome API.
 *
 * Usage contract (see App.vue):
 * - on scroll: scheduleSaveScrollPosition(activeHref) [debounced]
 * - before switching docs: flushScrollPosition(oldHref) [synchronous save]
 * - after rendering the new doc: loadScrollPosition(newHref) +
 *   restoreScrollPosition(saved) on hit, window.scrollTo(0, 0) on miss
 */

const CHROME_STORAGE_KEY = 'markcraft_scroll_positions'
const LOCAL_STORAGE_KEY = 'markcraft:scroll-positions'
const MAX_ENTRIES = 200
const SAVE_DEBOUNCE_MS = 250
const RESTORE_DELAYS_MS = [0, 40, 90, 160, 260, 420, 700, 1100]

/** In-memory cache: normalized doc key -> scrollY. Source of truth within a session. */
const memoryCache = new Map<string, number>()

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingHref = ''
let chromeHydrated = false

function getChromeStorage(): chrome.storage.LocalStorageArea | null {
  try {
    const g = globalThis as unknown as { chrome?: typeof chrome }
    return g.chrome?.storage?.local ?? null
  } catch {
    return null
  }
}

/**
 * Normalize a document href into a stable storage key.
 * The hash fragment never denotes a different document here (it is used for
 * in-page heading anchors), so it is stripped; query strings are kept.
 */
export function normalizeScrollKey(href: string): string {
  try {
    const url = new URL(href, window.location.href)
    url.hash = ''
    return url.href
  } catch {
    return href.split('#')[0]
  }
}

function trimCache(): Array<[string, number]> {
  const entries = Array.from(memoryCache.entries())
  return entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries
}

function persistToLocalStorage(): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Object.fromEntries(trimCache())))
  } catch {
    // Private mode / quota: memory cache still works for the session.
  }
}

function persistToChromeStorage(): void {
  const area = getChromeStorage()
  if (!area) return
  try {
    void area.set({ [CHROME_STORAGE_KEY]: Object.fromEntries(trimCache()) }).catch(() => {})
  } catch {
    // Extension context invalidated: ignore, localStorage copy remains.
  }
}

function isValidSavedY(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Read the live window scroll offset. */
export function readCurrentScrollY(): number {
  try {
    return window.scrollY ?? document.documentElement.scrollTop ?? document.body?.scrollTop ?? 0
  } catch {
    return 0
  }
}

/**
 * Synchronously remember `scrollY` for `href` in memory + localStorage,
 * and mirror it to chrome.storage.local (fire-and-forget).
 * Safe to call during a document switch before the render replaces the DOM.
 */
export function saveScrollPosition(href: string, scrollY: number): void {
  if (!href) return
  const key = normalizeScrollKey(href)
  const y = Math.max(0, Math.round(scrollY))
  memoryCache.set(key, y)
  // Re-insert order already handled by Map.set on existing keys (kept in place);
  // evict oldest when over capacity.
  while (memoryCache.size > MAX_ENTRIES) {
    const oldest = memoryCache.keys().next()
    if (oldest.done) break
    memoryCache.delete(oldest.value)
  }
  persistToLocalStorage()
  persistToChromeStorage()
}

/**
 * Debounced wrapper around saveScrollPosition that captures the live window
 * offset. Attach to the window scroll listener; the write lands ~250ms after
 * scrolling settles so rapid scroll events don't thrash storage.
 */
export function scheduleSaveScrollPosition(href: string): void {
  if (!href) return
  pendingHref = href
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const target = pendingHref
    pendingHref = ''
    saveScrollPosition(target, readCurrentScrollY())
  }, SAVE_DEBOUNCE_MS)
}

/**
 * Immediately persist the live window offset for `href` (default: the pending
 * debounced href, else the current location). Cancels any pending debounced
 * write first so a switch can't be preceded by a stale delayed write.
 */
export function flushScrollPosition(href?: string): void {
  const target = href || pendingHref || window.location.href
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  // If a different href was pending, it shares the same live offset — keep it too.
  if (pendingHref && pendingHref !== target) {
    saveScrollPosition(pendingHref, readCurrentScrollY())
  }
  pendingHref = ''
  saveScrollPosition(target, readCurrentScrollY())
}

/**
 * Load the remembered offset for `href`. Returns null when the document was
 * never read (caller should scroll to top). Resolution order: memory ->
 * chrome.storage.local -> localStorage. Hits from slower layers are promoted
 * into memory for subsequent synchronous reads.
 */
export async function loadScrollPosition(href: string): Promise<number | null> {
  if (!href) return null
  const key = normalizeScrollKey(href)
  const mem = memoryCache.get(key)
  if (isValidSavedY(mem)) return mem

  // One hydration from chrome.storage per session is enough; later saves
  // already mirrored there. localStorage is always read (cheap + synchronous).
  const area = getChromeStorage()
  if (area && !chromeHydrated) {
    chromeHydrated = true
    try {
      const data = await area.get(CHROME_STORAGE_KEY)
      const stored = (data as Record<string, unknown>)[CHROME_STORAGE_KEY]
      if (stored && typeof stored === 'object') {
        for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
          if (isValidSavedY(v) && !memoryCache.has(k)) memoryCache.set(k, v)
        }
        const hit = memoryCache.get(key)
        if (isValidSavedY(hit)) return hit
      }
    } catch {
      // Fall through to localStorage.
    }
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const hit = parsed[key]
      if (isValidSavedY(hit)) {
        memoryCache.set(key, hit)
        return hit
      }
    }
  } catch {
    // Corrupt JSON: treated as unread.
  }
  return null
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    try {
      requestAnimationFrame(() => resolve())
    } catch {
      setTimeout(resolve, 16)
    }
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Restore a remembered offset with retries. Rendered height settles
 * asynchronously (Vue v-html patch, images, Mermaid), so a single scrollTo may
 * clamp against a still-short document. Each attempt re-clamps to the live max
 * and keeps retrying while the window is still below the target; once the
 * target is reached (or attempts are exhausted) it stops.
 *
 * `shouldAbort` is polled between attempts so a superseding document switch
 * can cancel a stale restore instead of yanking the new document's viewport.
 */
export async function restoreScrollPosition(targetY: number, shouldAbort?: () => boolean): Promise<void> {
  const target = Math.max(0, Math.round(targetY))
  if (target <= 0) {
    if (!shouldAbort?.()) window.scrollTo(0, 0)
    return
  }
  for (let i = 0; i < RESTORE_DELAYS_MS.length; i++) {
    if (shouldAbort?.()) return
    if (i === 0) await nextFrame()
    else await sleep(RESTORE_DELAYS_MS[i])
    if (shouldAbort?.()) return
    let max = 0
    try {
      max = document.documentElement.scrollHeight - window.innerHeight
    } catch {
      break
    }
    const y = Math.min(target, Math.max(0, max))
    try {
      window.scrollTo(0, y)
    } catch {
      break
    }
    await nextFrame()
    const current = readCurrentScrollY()
    // Reached the target (or the whole page is shorter): done.
    if (Math.abs(current - target) <= 2 || y >= target - 2 || max <= 0) {
      // When clamped below the target the content may still grow — keep
      // retrying unless this was the last attempt.
      if (y >= target - 2 || i === RESTORE_DELAYS_MS.length - 1) break
    }
  }
}

/** Forget one document's remembered offset (e.g. after the file shrinks). */
export function forgetScrollPosition(href: string): void {
  if (!href) return
  memoryCache.delete(normalizeScrollKey(href))
  persistToLocalStorage()
  persistToChromeStorage()
}
