/**
 * Onboarding foundation (R2): bilingual copy (hardcoded zh+en, no i18n
 * framework) and persistent `seen` flags for the file-access guide card,
 * the 60s tour, and the save-back nudge.
 *
 * Flags live in chrome.storage.local (shared across tabs, survives reloads)
 * with a synchronous localStorage mirror so the first paint can decide
 * without awaiting the async storage read.
 */

export const SEEN_TOUR_KEY = 'markcraft_seen_tour'
export const SEEN_FILE_ACCESS_HINT_KEY = 'markcraft_seen_file_access_hint'
export const SEEN_SAVE_NUDGE_KEY = 'markcraft_seen_save_nudge'

export const NATIVE_HOST_README_URL =
  'https://github.com/markcraft-dev/markcraft/blob/main/native-host/README.md'

/** UI language: Chinese first (N4 covers full i18n later), English otherwise. */
export function isZhLang(): boolean {
  try {
    return (navigator.language || '').toLowerCase().startsWith('zh')
  } catch {
    return true
  }
}

export function pickCopy(zh: string, en: string): string {
  return isZhLang() ? zh : en
}

function readMirror(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeMirror(key: string): void {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Private mode / quota: chrome.storage copy still works.
  }
}

/** Synchronous first-paint check (localStorage mirror). */
export function hasSeenFlagSync(key: string): boolean {
  return readMirror(key)
}

/** Authoritative check (chrome.storage.local, falls back to the mirror). */
export async function hasSeenFlag(key: string): Promise<boolean> {
  if (readMirror(key)) return true
  try {
    const area = globalThis.chrome?.storage?.local
    if (!area) return false
    const data = await area.get(key)
    const seen = (data as Record<string, unknown>)[key] === true
    if (seen) writeMirror(key)
    return seen
  } catch {
    return false
  }
}

/** Persist a `seen` flag in both stores; never throws. */
export async function setSeenFlag(key: string): Promise<void> {
  writeMirror(key)
  try {
    await globalThis.chrome?.storage?.local?.set({ [key]: true })
  } catch {
    // Mirror already written; storage will catch up next time.
  }
}

export interface TourStep {
  titleZh: string
  titleEn: string
  bodyZh: string
  bodyEn: string
  shortcut: string
  /** Primary anchor: CSS selector of the UI this stop talks about. */
  target: string
  /** Fallback anchor when the primary is absent (save step: edit toggle). */
  altTarget?: string
  /** Body override shown together with the fallback anchor. */
  altBodyZh?: string
  altBodyEn?: string
}

/** Viewport-space rect passed from App (after nextTick) to TourBubble. */
export interface TourAnchorRect {
  x: number
  y: number
  width: number
  height: number
  /** Target's own corner radius in px (null = unknown); drives the spotlight shape. */
  radius?: number | null
}

/**
 * Parse a computed `border-radius` into px, clamped to half the short side.
 * Only the first (top-left) value is used; percentages resolve against the
 * short side. Returns null when unparseable — callers fall back to a default.
 */
export function parseBorderRadiusToPx(cssRadius: string, w: number, h: number): number | null {
  try {
    const first = (cssRadius || '').trim().split(/\s+/)[0]?.split('/')[0] || ''
    let v: number | null = null
    if (first.endsWith('%')) {
      const p = Number.parseFloat(first)
      if (Number.isFinite(p)) v = (p / 100) * Math.min(w, h)
    } else {
      const p = Number.parseFloat(first)
      if (Number.isFinite(p)) v = p
    }
    if (v === null || v < 0) return null
    return Math.min(v, Math.min(w, h) / 2)
  } catch {
    return null
  }
}

/** The 60s tour: palette → outline → edit → save. Four stops, text-only. */
export const TOUR_STEPS: TourStep[] = [
  {
    titleZh: '快速搜索跳转',
    titleEn: 'Search & jump',
    bodyZh: '按快捷键打开搜索面板，按文件名或标题秒跳本文档与目录。',
    bodyEn: 'Open the palette to jump by filename or heading, here or across the folder.',
    shortcut: '⌘K',
    target: '[data-tour="search-entry"]'
  },
  {
    titleZh: '大纲导航',
    titleEn: 'Outline',
    bodyZh: '右侧大纲随阅读高亮，点击标题直达章节。',
    bodyEn: 'The right outline follows your reading; click a heading to jump.',
    shortcut: '⌘U',
    target: '[data-tour="outline-panel"]'
  },
  {
    titleZh: '原地编辑',
    titleEn: 'Edit in place',
    bodyZh: '直接在页面上改，所见即所得，改完保存写回原文件。',
    bodyEn: 'Edit right on the page; saving writes back to the original file.',
    shortcut: '⌘E',
    target: '[data-tour="edit-toggle"]'
  },
  {
    titleZh: '保存回原文件',
    titleEn: 'Save back',
    bodyZh: '编辑模式下保存，首次需授权一次，之后静默覆盖。',
    bodyEn: 'Save in edit mode; authorize once, then it overwrites silently.',
    shortcut: '⌘S',
    target: '[data-tour="save-button"]',
    altTarget: '[data-tour="edit-toggle"]',
    altBodyZh: '先点编辑，再点保存：点击编辑开关进入编辑模式，修改后点保存写回原文件。',
    altBodyEn: 'Edit first, then save: flip the edit switch to enter edit mode, then save writes back.'
  }
]
