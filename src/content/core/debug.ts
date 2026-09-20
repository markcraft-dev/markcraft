/**
 * Debug mode (R2 follow-up): one-click state reset for re-testing onboarding.
 *
 * Read-only enumeration plus targeted clearing; never touches business
 * modules. Two scopes:
 * - 'tour': clears only the 2 onboarding `seen` flags (tour, save-back
 *   nudge) from chrome.storage.local AND their localStorage mirrors. The
 *   caller reloads so App re-runs first-run paths with everything else
 *   (scroll places, recents, settings) intact.
 *   (T25: the file-access guide card is gone, so its retired flag is no
 *   longer cleared here; the 'all' wipe still removes the stale key.)
 * - 'all': clears every enumerated MarkCraft key (chrome markcraft* keys,
 *   localStorage markcraft* mirrors, the two sessionStorage workspace keys)
 *   and reloads. The bare `settings` key is deliberately preserved — it is
 *   user preferences, not debug/tour state. File handles in IndexedDB
 *   (`markcraft_filesystem_db`) are likewise left alone: dropping granted
 *   handles silently would strand in-flight saves.
 */

import {
  SEEN_TOUR_KEY,
  SEEN_SAVE_NUDGE_KEY
} from './onboarding'

/** The 2 onboarding `seen` flags cleared by the 'tour' scope. */
export const TOUR_SEEN_KEYS: readonly string[] = [
  SEEN_TOUR_KEY,
  SEEN_SAVE_NUDGE_KEY
]

/** chrome.storage.local filter: everything MarkCraft owns except `settings`. */
const CHROME_KEY_PREFIX = 'markcraft'

/** localStorage filter: same prefix covers mirrors + seen flags. */
const LOCAL_KEY_PREFIX = 'markcraft'

/**
 * sessionStorage workspace keys (owned by Side.vue; hardcoded here so this
 * module stays dependency-free — keep in sync with Side.vue).
 */
const SESSION_KEYS: readonly string[] = [
  'markcraft_workspace_root',
  'markcraft_expanded_folders'
]

export type StateArea = 'chrome' | 'local' | 'session'

export interface MarkcraftStateEntry {
  area: StateArea
  key: string
}

export interface MarkcraftStateSnapshot {
  entries: MarkcraftStateEntry[]
  chromeKeys: string[]
  localKeys: string[]
  sessionKeys: string[]
}

export type ClearScope = 'tour' | 'all'

function getChromeStorage(): chrome.storage.LocalStorageArea | null {
  try {
    const g = globalThis as unknown as { chrome?: typeof chrome }
    return g.chrome?.storage?.local ?? null
  } catch {
    return null
  }
}

function readStorageKeys(store: Storage | null, pick: (key: string) => boolean): string[] {
  if (!store) return []
  const out: string[] = []
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key && pick(key)) out.push(key)
    }
  } catch {
    // Storage denied (private mode): report what we could read.
  }
  return out.sort()
}

function getLocalStore(): Storage | null {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function getSessionStore(): Storage | null {
  try {
    return window.sessionStorage ?? null
  } catch {
    return null
  }
}

/**
 * Enumerate all MarkCraft-owned local state. Read-only; never throws —
 * denied stores simply contribute nothing.
 */
export async function enumerateMarkcraftState(): Promise<MarkcraftStateSnapshot> {
  let chromeKeys: string[] = []
  const area = getChromeStorage()
  if (area) {
    try {
      const all = await area.get(null)
      chromeKeys = Object.keys(all || {})
        .filter((k) => k.startsWith(CHROME_KEY_PREFIX))
        .sort()
    } catch {
      chromeKeys = []
    }
  }
  const localKeys = readStorageKeys(getLocalStore(), (k) => k.startsWith(LOCAL_KEY_PREFIX))
  const sessionStore = getSessionStore()
  const sessionKeys = SESSION_KEYS.filter((k) => {
    try {
      return sessionStore?.getItem(k) !== null && sessionStore?.getItem(k) !== undefined
    } catch {
      return false
    }
  })
  return {
    entries: [
      ...chromeKeys.map((key): MarkcraftStateEntry => ({ area: 'chrome', key })),
      ...localKeys.map((key): MarkcraftStateEntry => ({ area: 'local', key })),
      ...sessionKeys.map((key): MarkcraftStateEntry => ({ area: 'session', key }))
    ],
    chromeKeys,
    localKeys,
    sessionKeys
  }
}

async function removeChromeKeys(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0
  const area = getChromeStorage()
  if (!area) return 0
  try {
    await area.remove(keys)
    return keys.length
  } catch {
    return 0
  }
}

function removeWebKeys(store: Storage | null, keys: string[]): number {
  if (!store || keys.length === 0) return 0
  let removed = 0
  for (const key of keys) {
    try {
      store.removeItem(key)
      removed += 1
    } catch {
      // Keep going: best-effort wipe.
    }
  }
  return removed
}

/**
 * Clear MarkCraft state by scope. Returns the number of keys removed.
 * - 'tour': the 2 seen flags (chrome + localStorage mirror). No reload here;
 *   the caller reloads so first-run UI replays with other state intact.
 * - 'all': every enumerated key, then location.reload() so no stale
 *   in-memory copy (scroll/recents caches) survives the wipe.
 */
export async function clearMarkcraftState(scope: ClearScope): Promise<{ removed: number }> {
  let removed = 0
  if (scope === 'tour') {
    removed += await removeChromeKeys([...TOUR_SEEN_KEYS])
    removed += removeWebKeys(getLocalStore(), [...TOUR_SEEN_KEYS])
    return { removed }
  }
  const snapshot = await enumerateMarkcraftState()
  removed += await removeChromeKeys(snapshot.chromeKeys)
  removed += removeWebKeys(getLocalStore(), snapshot.localKeys)
  removed += removeWebKeys(getSessionStore(), snapshot.sessionKeys)
  try {
    window.location.reload()
  } catch {
    // Non-browser harness: wipe still applied.
  }
  return { removed }
}
