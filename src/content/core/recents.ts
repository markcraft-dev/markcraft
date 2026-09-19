/**
 * Recent documents + reading-progress snapshots (R6 schema, shared with R9).
 *
 * Schema (v1): RecentDoc { key, href, title, mtime, scrollY, progress }.
 * - `key` reuses scroll-memory's normalizeScrollKey (hash stripped), so the
 *   recents store and the scroll store address the same document identically.
 * - Kept to the 20 most-recently-touched documents (LRU); quota/corrupt
 *   payloads degrade to an empty list and never break reading.
 * - Persistence mirrors scroll-memory: in-memory source of truth, mirrored
 *   to chrome.storage.local with a localStorage fallback.
 *
 * Reading snapshots (R9): scrollY + progress (0–100) are written on the same
 * rhythm as scroll saves — debounced during scrolling, synchronously when
 * leaving a document / hiding the page. The sidebar resume badges and the
 * palette recents read from here; "continue reading" is a doc switch, which
 * restores the remembered offset within ±2px (tighter than R9's ±24px bar).
 */

import { normalizeScrollKey } from './scroll-memory.js'

export interface RecentDoc {
  /** Stable key: normalizeScrollKey(href). */
  key: string
  /** Full document URL as opened. */
  href: string
  /** Display title (decoded file name). */
  title: string
  /** Last touch, epoch ms. Drives LRU order. */
  mtime: number
  /** Last seen vertical offset. */
  scrollY: number
  /** Last seen reading progress, 0–100. */
  progress: number
}

/** R6: at most 20 recent documents. */
export const RECENTS_MAX = 20
/** Snapshot write debounce: same family as scroll saves, slightly lazier. */
const SNAPSHOT_DEBOUNCE_MS = 500

const CHROME_STORAGE_KEY = 'markcraft_recent_docs'
const LOCAL_STORAGE_KEY = 'markcraft:recent-docs'

let memoryRecents: RecentDoc[] = []
let chromeHydrated = false
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
let pendingSnapshotHref = ''

type RecentsListener = (recents: RecentDoc[]) => void
const listeners = new Set<RecentsListener>()

function getChromeStorage(): chrome.storage.LocalStorageArea | null {
  try {
    const g = globalThis as unknown as { chrome?: typeof chrome }
    return g.chrome?.storage?.local ?? null
  } catch {
    return null
  }
}

/** Display title from an href: decoded file name, 'Markdown' fallback. */
export function deriveRecentTitle(href: string): string {
  try {
    const clean = href.split('?')[0].split('#')[0]
    const file = clean.split('/').pop() || ''
    return decodeURIComponent(file) || 'Markdown'
  } catch {
    return 'Markdown'
  }
}

function clampProgress(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

function clampScrollY(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.round(n))
}

/**
 * Validate + normalize a raw stored payload. Anything malformed (wrong
 * shape, bad entries, quota-exceeded partial writes) becomes a clean list —
 * clearing data must never affect reading.
 */
export function sanitizeRecentList(raw: unknown): RecentDoc[] {
  if (!Array.isArray(raw)) return []
  const out: RecentDoc[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const href = typeof rec.href === 'string' ? rec.href : ''
    if (!href) continue
    const key = typeof rec.key === 'string' && rec.key ? rec.key : normalizeScrollKey(href)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      href,
      title: typeof rec.title === 'string' && rec.title ? rec.title : deriveRecentTitle(href),
      mtime: typeof rec.mtime === 'number' && Number.isFinite(rec.mtime) ? rec.mtime : 0,
      scrollY: clampScrollY(rec.scrollY),
      progress: clampProgress(rec.progress)
    })
  }
  return out.slice(0, RECENTS_MAX)
}

/**
 * Pure LRU touch: move `entry.key` to the front (or insert it), cap at
 * `max`. Unit-tested in tests/recents.test.mjs (R6 acceptance).
 */
export function touchRecentList(
  list: RecentDoc[],
  entry: RecentDoc,
  max: number = RECENTS_MAX
): RecentDoc[] {
  const rest = list.filter((r) => r.key !== entry.key)
  rest.unshift(entry)
  return rest.slice(0, Math.max(1, max))
}

/** Live reading progress with the same formula as App.updateReadingProgress. */
export function computeReadingProgress(): number {
  try {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    return docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0
  } catch {
    return 0
  }
}

function persist(): void {
  const payload = memoryRecents.slice(0, RECENTS_MAX)
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Private mode / quota: memory copy still works for the session.
  }
  const area = getChromeStorage()
  if (!area) return
  try {
    void area.set({ [CHROME_STORAGE_KEY]: payload }).catch(() => {})
  } catch {
    // Extension context invalidated: localStorage copy remains.
  }
}

function notify(): void {
  const snapshot = [...memoryRecents]
  for (const cb of listeners) {
    try {
      cb(snapshot)
    } catch {
      // A failing subscriber must not break the store.
    }
  }
}

/** Subscribe to recents changes (sidebar badges). Returns an unsubscribe fn. */
export function subscribeRecents(cb: RecentsListener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Synchronous in-memory read (call ensureRecentsLoaded() first at mount). */
export function getRecents(): RecentDoc[] {
  return [...memoryRecents]
}

/** One-time hydration from persistent layers into memory. */
export async function ensureRecentsLoaded(): Promise<RecentDoc[]> {
  const area = getChromeStorage()
  if (area && !chromeHydrated) {
    chromeHydrated = true
    try {
      const data = await area.get(CHROME_STORAGE_KEY)
      const stored = (data as Record<string, unknown>)[CHROME_STORAGE_KEY]
      const clean = sanitizeRecentList(stored)
      if (clean.length > 0) {
        memoryRecents = clean
        notify()
        return getRecents()
      }
    } catch {
      // Fall through to localStorage.
    }
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const clean = sanitizeRecentList(JSON.parse(raw))
      if (clean.length > 0 && memoryRecents.length === 0) {
        memoryRecents = clean
        notify()
      }
    }
  } catch {
    // Corrupt JSON: treated as no recents.
  }
  return getRecents()
}

/**
 * Touch a document as recently read: reorder to front with fresh mtime.
 * Call on document switch-in (and initial load). Snapshot fields default to
 * the live viewport so a fresh entry already carries a usable place.
 */
export function touchRecent(
  href: string,
  partial?: Partial<Pick<RecentDoc, 'title' | 'scrollY' | 'progress'>>
): RecentDoc[] {
  if (!href) return getRecents()
  const key = normalizeScrollKey(href)
  let liveY = 0
  try {
    liveY = window.scrollY ?? 0
  } catch {
    liveY = 0
  }
  const entry: RecentDoc = {
    key,
    href,
    title: partial?.title ?? deriveRecentTitle(href),
    mtime: Date.now(),
    scrollY: clampScrollY(partial?.scrollY ?? liveY),
    progress: clampProgress(partial?.progress ?? computeReadingProgress())
  }
  memoryRecents = touchRecentList(memoryRecents, entry)
  persist()
  notify()
  return getRecents()
}

/**
 * Synchronously persist the live viewport as this document's snapshot
 * (scrollY + progress). Call when leaving a document or hiding the page —
 * same moments scroll-memory flushes, so the two stores never disagree.
 */
export function recordReadingSnapshot(href: string): void {
  if (!href) return
  const key = normalizeScrollKey(href)
  let liveY = 0
  try {
    liveY = window.scrollY ?? 0
  } catch {
    liveY = 0
  }
  const progress = computeReadingProgress()
  const idx = memoryRecents.findIndex((r) => r.key === key)
  if (idx === -1) {
    memoryRecents = touchRecentList(memoryRecents, {
      key,
      href,
      title: deriveRecentTitle(href),
      mtime: Date.now(),
      scrollY: clampScrollY(liveY),
      progress
    })
  } else {
    memoryRecents[idx] = {
      ...memoryRecents[idx],
      href,
      scrollY: clampScrollY(liveY),
      progress
    }
  }
  persist()
  notify()
}

/**
 * Debounced snapshot for the scroll handler. Pairs with
 * scheduleSaveScrollPosition: one rhythm for offsets, one (lazier) write for
 * the progress badges, so rapid scrolling doesn't thrash storage.
 */
export function scheduleReadingSnapshot(href: string): void {
  if (!href) return
  pendingSnapshotHref = href
  if (snapshotTimer !== null) clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    const target = pendingSnapshotHref
    pendingSnapshotHref = ''
    recordReadingSnapshot(target)
  }, SNAPSHOT_DEBOUNCE_MS)
}

/** Test seam: reset module state (mirrors scroll-memory's testability). */
export function resetRecentsForTest(): void {
  memoryRecents = []
  chromeHydrated = false
  if (snapshotTimer !== null) {
    clearTimeout(snapshotTimer)
    snapshotTimer = null
  }
  pendingSnapshotHref = ''
  listeners.clear()
}
