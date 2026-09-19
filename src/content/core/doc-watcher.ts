/**
 * Auto-reload on file change (product plan P1-1, pain point U6).
 *
 * Dev-doc readers edit in VS Code and read in the browser; Markdown Preview
 * Plus's most-praised feature is refreshing the view when the file changes on
 * disk. This module polls the active document through the background worker
 * (`fetchDocContent`, which already retries cold-start failures) and reports
 * external changes. It is deliberately opt-in and local-only:
 *
 * - Enabled only when `settings.autoReload` is true AND the page is a local
 *   `file://` document (never polls remote URLs).
 * - Paused while the user is editing (`isEditMode` / `isDirty`) or a document
 *   switch is in flight, so it can never clobber unsaved work or a switch.
 * - Skips polling while the tab is hidden (`visibilityState`), avoiding
 *   background wake-ups; the next visible tick catches up.
 * - Stale-fetch guard: the snapshot (href + content) is captured BEFORE the
 *   fetch starts, and the caller re-checks it before applying — a save or a
 *   switch that lands mid-fetch drops the result instead of reverting the view.
 *
 * Scroll is preserved by the caller via the same-document `handleContentChange`
 * path (see App.vue), which keeps the live offset across re-renders.
 */

export interface DocWatcherSnapshot {
  href: string
  content: string
}

export interface DocWatcherCallbacks {
  /** Fetch raw markdown (already retrying, e.g. `fetchDocContent`). Null = failure, skip round. */
  fetchContent: (href: string) => Promise<string | null>
  /** Current live document; null when there is nothing to watch. */
  getSnapshot: () => DocWatcherSnapshot | null
  /** True while the user edits, has unsaved changes, or a switch is in flight. */
  isPaused: () => boolean
  /** True when the feature is opted in (settings) on a local document. */
  isEnabled: () => boolean
  /** Fresh on-disk content differs from the baseline snapshot — apply it. */
  onExternalChange: (fresh: string, baseline: DocWatcherSnapshot) => void
}

export interface DocWatcherHandle {
  stop: () => void
  /** Run one poll round immediately (e.g. right after the toggle is flipped on). */
  checkNow: () => void
}

/** Poll cadence: worst-case detection ≈ interval + one fetch round-trip (≤2s per P1-1). */
export const DOC_WATCHER_POLL_MS = 1500

export function startDocWatcher(cb: DocWatcherCallbacks): DocWatcherHandle {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false

  function schedule(delay: number) {
    if (stopped) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(tick, delay)
  }

  async function tick() {
    timer = null
    if (stopped) return
    if (!inFlight && cb.isEnabled() && !cb.isPaused()) {
      try {
        if (document.visibilityState === 'visible') {
          const baseline = cb.getSnapshot()
          if (baseline && baseline.href) {
            inFlight = true
            try {
              const fresh = await cb.fetchContent(baseline.href)
              if (!stopped && fresh !== null && fresh !== baseline.content) {
                cb.onExternalChange(fresh, baseline)
              }
            } finally {
              inFlight = false
            }
          }
        }
      } catch {
        // Transient errors (e.g. extension context hiccups) just skip a round.
      }
    }
    schedule(DOC_WATCHER_POLL_MS)
  }

  schedule(DOC_WATCHER_POLL_MS)
  return {
    stop() {
      stopped = true
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
    checkNow() {
      if (!stopped && !inFlight) {
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
        void tick()
      }
    }
  }
}
