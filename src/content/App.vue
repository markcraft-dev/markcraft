<template>
  <div class="mdr-app flex flex-col min-h-screen bg-[--bg-page] text-[--text-primary] transition-colors duration-150 relative">
    <!-- extension-style Top Navigation Header Bar (Unified Full-Width Bar) -->
    <TopHeader
      :theme="currentTheme"
      :left-open="leftSideOpen"
      :right-open="rightSideOpen"
      :is-local="isLocal"
      :is-edit-mode="isEditMode"
      :is-dirty="isDirty"
      :doc-title="currentDocTitle"
      :folder-name="currentDocFolder"
      :read-progress="readingProgress"
      @toggle-left-side="leftSideOpen = !leftSideOpen"
      @toggle-right-side="rightSideOpen = !rightSideOpen"
      @toggle-theme="toggleTheme"
      @open-settings="settingsVisible = true"
      @open-search="searchVisible = true"
      @toggle-edit="toggleEditMode"
      @save="saveInPlace"
      @finish-edit="finishInPlaceEdit"
      @discard-edit="cancelInPlaceEdit"
    />

    <!-- Floating Text Selection Formatting Toolbar (extension/Notion Style) -->
    <InPlaceFormattingToolbar
      :active="isEditMode"
      :container="contentRef"
    />

    <!-- Main Workspace Layout with Left Sidebar, Central Content & Right Outline Card -->
    <div class="flex-1 flex pt-44px relative min-h-screen">
      <!-- Left Sidebar: Dedicated File Explorer -->
      <Side
        v-if="leftSideOpen && isLocal"
        ref="sideRef"
        :is-local="isLocal"
        :width="leftSideWidth"
        @update:width="(w) => leftSideWidth = w"
        @change-raw="handleContentChange"
        @open-settings="settingsVisible = true"
        @open-search="searchVisible = true"
        @tree-loaded="(nodes) => folderTreeNodes = nodes"
      />

      <!-- Main Content Reading & In-Place Editing Canvas -->
      <main
        class="mdr-main flex-1 transition-[margin] duration-200 min-w-0"
        :style="{
          marginLeft: leftSideOpen && isLocal ? `${leftSideWidth}px` : '0',
          marginRight: rightSideOpen ? `${rightSideWidth + 28}px` : '0'
        }"
      >
        <div class="mdr-container mx-auto px-28px sm:px-44px py-36px max-w-[var(--content-max-width,900px)]">
          <!-- Rendered Markdown HTML Reading & In-Place WYSIWYG Article -->
          <article
            v-if="!isRawView"
            ref="contentRef"
            class="mdr-content transition-all"
            :class="{ 'mdr-in-place-editing': isEditMode }"
            :contenteditable="isEditMode"
            spellcheck="false"
            v-html="renderedHtml"
            @input="handleInPlaceInput"
          ></article>
          <!-- R5 RAW source view: plain pre over the held raw markdown, no refetch -->
          <pre
            v-else
            class="mdr-raw-view"
          >{{ rawMarkdownContent }}</pre>
        </div>
      </main>

      <!-- Right Sidebar: Dedicated Article Outline & Metadata (extension floating Card) -->
      <RightSidebar
        v-if="rightSideOpen"
        :outline-list="outlineData.list"
        :raw-content="rawMarkdownContent"
        :width="rightSideWidth"
        @update:width="(w) => rightSideWidth = w"
      />
    </div>

    <!-- Bottom Right Floating Back to Top with Scroll Progress -->
    <BackToTop />

    <!-- R5 RAW toggle: floating pill, bottom-left to avoid the BackToTop corner -->
    <button
      v-if="!isEditMode"
      class="fixed bottom-24px left-16px z-40 px-12px py-6px rounded-full text-11px font-mono font-semibold cursor-pointer border transition-opacity"
      :class="isRawView
        ? 'bg-[--primary-color] text-white border-transparent shadow-lg'
        : 'bg-[--bg-subtle]/90 text-[--text-secondary] border-[--border-color] hover:text-[--text-primary] backdrop-blur'"
      :title="isRawView
        ? pickCopy('返回渲染视图 (⌘/Ctrl+Shift+M)', 'Back to rendered view (⌘/Ctrl+Shift+M)')
        : pickCopy('查看源码 (⌘/Ctrl+Shift+M)', 'View source (⌘/Ctrl+Shift+M)')"
      @click="toggleRawView"
    >
      {{ isRawView ? pickCopy('预览', 'Preview') : 'RAW' }}
    </button>

    <!-- R2 60s tour bubble -->
    <TourBubble
      v-if="tourVisible"
      :step="tourStep"
      :total="TOUR_STEPS.length"
      :title="tourTitle"
      :body="tourBody"
      :shortcut="tourShortcut"
      :is-first="tourStep === 0"
      :is-last="tourStep === TOUR_STEPS.length - 1"
      :anchor="tourAnchor"
      @next="tourNext"
      @prev="tourPrev"
      @skip="finishTour"
    />

    <!-- R2 save-back nudge: dialog-free native-host option, dismissible forever -->
    <transition name="toast-fade">
      <div
        v-if="saveNudgeVisible"
        class="fixed bottom-150px left-1/2 -translate-x-1/2 z-50 w-[min(460px,92vw)] px-14px py-10px rounded-xl bg-[#18181b] text-white text-12px shadow-2xl border border-white/10 flex items-center gap-10px"
      >
        <span class="flex-1 leading-relaxed">{{ saveNudgeText }}</span>
        <a
          class="flex-shrink-0 underline underline-offset-2 text-white/85 hover:text-white"
          :href="NATIVE_HOST_README_URL"
          target="_blank"
          rel="noopener"
        >{{ pickCopy('查看说明', 'Docs') }}</a>
        <button
          class="flex-shrink-0 px-8px py-3px rounded-lg bg-white/15 hover:bg-white/25 text-white text-11px cursor-pointer border-0"
          @click="dismissSaveNudge"
        >
          {{ saveNudgeDismissLabel }}
        </button>
      </div>
    </transition>

    <!-- Centered Search Command Palette (Screenshot 3 - Cmd+K) -->
    <SearchPaletteModal
      :visible="searchVisible"
      :files="folderTreeNodes"
      :headings="outlineData.list"
      @close="searchVisible = false"
      @select-file="handlePaletteSelectFile"
      @select-heading="handlePaletteSelectHeading"
      @trigger-action="handlePaletteAction"
    />

    <!-- Centered Settings Dialog (Zero Long Mouse Travel & Click-Outside to Dismiss) -->
    <SettingsModal
      :visible="settingsVisible"
      @close="settingsVisible = false"
      @theme-changed="(t) => currentTheme = t"
    />

    <!-- Image Lightbox Modal & Downloader -->
    <ImageLightbox
      :visible="lightboxVisible"
      :src="lightboxSrc"
      :alt="lightboxAlt"
      @close="lightboxVisible = false"
    />

    <!-- Floating Global Toast Notification -->
    <transition name="toast-fade">
      <div
        v-if="toastMessage"
        class="fixed bottom-24px left-1/2 -translate-x-1/2 z-50 px-16px py-9px rounded-xl bg-[#18181b] text-white text-12px font-medium shadow-2xl border border-white/10 flex items-center gap-6px pointer-events-none"
      >
        <span>{{ toastMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import TopHeader from './components/TopHeader.vue'
import Side from './components/Side.vue'
import RightSidebar from './components/RightSidebar.vue'
import InPlaceFormattingToolbar from './components/InPlaceFormattingToolbar.vue'
import BackToTop from './components/BackToTop.vue'
import SettingsModal from './components/SettingsModal.vue'
import SearchPaletteModal, { type PaletteItem } from './components/SearchPaletteModal.vue'
import ImageLightbox from './components/ImageLightbox.vue'
import TourBubble from './components/TourBubble.vue'
import {
  hasSeenFlag,
  setSeenFlag,
  pickCopy,
  parseBorderRadiusToPx,
  TOUR_STEPS,
  SEEN_TOUR_KEY,
  SEEN_SAVE_NUDGE_KEY,
  NATIVE_HOST_README_URL,
  type TourAnchorRect
} from './core/onboarding'
import { renderMarkdown, renderMermaidDiagrams, rerenderMermaidDiagrams } from './core/markdown'
import { sanitizeHtml } from './core/sanitize'
import { extractOutline } from './core/outline'
import { applyTheme, applyCustomStyles } from './core/theme'
import { enhanceContentBlocks, renderTocContainer } from './core/enhancements'
import { copyAsRichText, exportAsStandaloneHtml, exportElementAsStandaloneHtml } from './core/export'
import { domToMarkdown } from './core/dom-to-markdown'
import {
  flushScrollPosition,
  loadScrollPosition,
  readCurrentScrollY,
  restoreScrollPosition,
  saveScrollPosition,
  scheduleSaveScrollPosition
} from './core/scroll-memory'
import {
  buildSectionUrl,
  fetchDocContent,
  isSameDocument,
  parseDocUrl,
  syncDocUrl
} from './core/doc-url'
import { startDocWatcher, type DocWatcherHandle, type DocWatcherSnapshot } from './core/doc-watcher'
import { storeFileHandle, storeDirectoryHandle, trySilentSave, trySilentSaveViaDirectory, writeToFileHandle } from './core/file-handle-storage'
import { tryNativeSave } from './core/native-save'
import {
  ensureRecentsLoaded,
  recordReadingSnapshot,
  scheduleReadingSnapshot,
  touchRecent
} from './core/recents'
import { useStorage, normalizeSettings } from '@/shared/storage'
import type { OutlineItem, PageTheme, TreeNodeItem } from '@/shared/types'

const props = defineProps<{
  initialContent: string
}>()

const isLocal = ref(window.location.protocol === 'file:')
const leftSideOpen = ref(true)
const rightSideOpen = ref(window.innerWidth > 1200)
const leftSideWidth = ref(260)
const rightSideWidth = ref(250)

const currentTheme = ref<PageTheme>('auto')
const readingProgress = ref(0)
const settingsVisible = ref(false)
const searchVisible = ref(false)
const isEditMode = ref(false)
const isDirty = ref(false)
const rawMarkdownContent = ref(props.initialContent)
const renderedHtml = ref('')
const currentActiveHref = ref(window.location.href)

const currentDocTitle = computed(() => {
  try {
    const url = currentActiveHref.value
    const clean = url.split('?')[0].split('#')[0]
    const file = clean.split('/').pop() || ''
    return decodeURIComponent(file) || 'Markdown'
  } catch {
    return 'Markdown'
  }
})

const currentDocFolder = computed(() => {
  try {
    const url = currentActiveHref.value
    const clean = url.split('?')[0].split('#')[0]
    const parts = clean.split('/')
    if (parts.length >= 2) {
      return decodeURIComponent(parts[parts.length - 2])
    }
  } catch {}
  return ''
})

function updateReadingProgress() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  readingProgress.value = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0
}

// Window scroll handler: refresh the header progress and debounce-persist the
// offset under the active document so each file keeps its own place.
// The tour suppresses saves so highlighting bubbles never pollute memory.
let suppressScrollSave = false
function handleWindowScroll() {
  updateReadingProgress()
  if (!suppressScrollSave) {
    scheduleSaveScrollPosition(currentActiveHref.value)
    // R9: same rhythm family as the offset save, lazier write — feeds the
    // recents snapshots (sidebar resume badges) without thrashing storage.
    scheduleReadingSnapshot(currentActiveHref.value)
  }
}

// Scroll-switch epoch: bumped on every document switch so a superseded
// switch neither persists nor restores scroll after a newer one took over.
// `restorePendingHref` marks a document whose restore hasn't settled —
// switching away from it must NOT flush the live viewport (which still shows
// the previous document's offset) over its stored place.
let scrollSwitchSeq = 0
let restorePendingHref: string | null = null

// Restore the remembered offset for `href` with async-height retries.
// Unread documents (no saved offset) start at the top — this is the Bug1 fix:
// without it an in-place doc switch keeps the previous document's offset.
// `token` cancels stale restores when a newer switch supersedes this one.
async function restoreDocScroll(href: string, token: number) {
  restorePendingHref = href
  try {
    const saved = await loadScrollPosition(href)
    if (token !== scrollSwitchSeq) return
    if (saved !== null && saved > 0) {
      await restoreScrollPosition(saved, () => token !== scrollSwitchSeq)
    } else if (token === scrollSwitchSeq) {
      window.scrollTo(0, 0)
    }
    if (token === scrollSwitchSeq) updateReadingProgress()
  } finally {
    if (restorePendingHref === href) restorePendingHref = null
  }
}
const contentRef = ref<HTMLElement | null>(null)
const sideRef = ref<InstanceType<typeof Side> | null>(null)
const outlineData = ref<{ tree: OutlineItem[]; list: OutlineItem[] }>({ tree: [], list: [] })
const folderTreeNodes = ref<TreeNodeItem[]>([])
const toastMessage = ref('')

// Lightbox state
const lightboxVisible = ref(false)
const lightboxSrc = ref('')
const lightboxAlt = ref('')

function openLightbox(src: string, alt: string) {
  if (isEditMode.value) return // Don't open lightbox during editing
  lightboxSrc.value = src
  lightboxAlt.value = alt
  lightboxVisible.value = true
}

const { settings, loadSettings, saveSettings } = useStorage()

// 渲染序号守卫：快速连续切换文档时丢弃过期渲染的后处理（增强/大纲/图表），
// 避免 Mermaid 等异步后处理跑在已被替换的 DOM 上
let renderSeq = 0
async function updateMarkdown(rawText: string) {
  const seq = ++renderSeq
  rawMarkdownContent.value = rawText
  // R0/G1: every render passes through the sanitize chain before reaching
  // v-html — untrusted markdown (<script>, on*, javascript:, @import) is
  // neutralized while Mermaid/KaTeX structure, task-list inputs and heading
  // ids are preserved (see reference/fixtures/xss.md EXPECTED).
  renderedHtml.value = sanitizeHtml(renderMarkdown(rawText, settings.value.mdPlugins))
  await nextTick()
  if (seq !== renderSeq) return

  if (contentRef.value) {
    // R8: hover anchors copy via doc-url so hash-route pages produce links
    // to the shown document, not to the underlying page file.
    enhanceContentBlocks(contentRef.value, openLightbox, (slug) =>
      buildSectionUrl(currentActiveHref.value, slug)
    )
    await refreshOutline()
  }

  if (seq !== renderSeq) return
  await renderMermaidDiagrams()
}

async function handleContentChange(newContent: string, newHref?: string, urlOpts?: { replace?: boolean }) {
  const oldHref = currentActiveHref.value
  const nextHref = newHref || oldHref
  const isSwitch = nextHref !== oldHref
  const mySwitch = isSwitch ? ++scrollSwitchSeq : scrollSwitchSeq
  // Same-document re-render (e.g. settings change): keep the live offset —
  // replacing v-html resets the DOM and may jump otherwise.
  const liveY = readCurrentScrollY()
  if (isSwitch) {
    if (restorePendingHref !== oldHref) {
      // Save-then-restore ordering: persist A's offset BEFORE it is replaced,
      // otherwise A's place is lost and B inherits A's viewport (Bug1).
      flushScrollPosition(oldHref)
      // R6/R9: snapshot A's place (scrollY + progress) at the same moment so
      // the recents store and the scroll store never disagree.
      recordReadingSnapshot(oldHref)
    }
    // Else: the old document never settled (fast double-switch) — its live
    // viewport still shows an even older document, so leave its stored
    // offset untouched instead of poisoning it.
    currentActiveHref.value = nextHref
    // Drop the stale progress immediately so the header doesn't show A's
    // 100% while B is still rendering.
    readingProgress.value = 0
  }
  await updateMarkdown(newContent)
  // A newer switch took over while rendering: it owns the viewport now.
  if (mySwitch !== scrollSwitchSeq) return
  if (isSwitch) {
    // URL sync AFTER the new document is determined + rendered, BEFORE
    // scroll restore (doc-first ordering): refresh / paste / share then
    // reopen exactly this document, and scroll-memory restores its offset.
    syncDocUrl(nextHref, urlOpts)
    await restoreDocScroll(nextHref, mySwitch)
    // R6: the new document is now the most recent; its entry carries the
    // restored place, later refined by scroll snapshots as the user reads.
    if (mySwitch === scrollSwitchSeq) {
      touchRecent(nextHref, { scrollY: readCurrentScrollY(), progress: readingProgress.value })
    }
  } else if (currentActiveHref.value === nextHref) {
    window.scrollTo(0, liveY)
    updateReadingProgress()
  }
}

function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 2800)
}

// R5 RAW source toggle (MarkView parity): instant switch between the rendered
// view and the `pre` source text. Reuses the already-held rawMarkdownContent
// (zero refetch) and restores the same scroll-memory key after the DOM swap.
const isRawView = ref(false)
function toggleRawView() {
  if (isEditMode.value) {
    showToast(pickCopy('请先退出编辑模式再查看源码', 'Exit edit mode before viewing source'))
    return
  }
  saveScrollPosition(currentActiveHref.value, readCurrentScrollY())
  isRawView.value = !isRawView.value
  void nextTick().then(async () => {
    const saved = await loadScrollPosition(currentActiveHref.value)
    window.scrollTo(0, saved ?? 0)
    updateReadingProgress()
  })
}

// R2 60s tour: four stops, skippable, first-run only. Scroll-save stays
// suppressed while the tour is active so it never pollutes scroll memory.
// T20: each stop anchors to its UI (bubble + highlight ring); missing or
// hidden targets fall back to bottom-center.
const tourVisible = ref(false)
const tourStep = ref(0)
// Viewport-space anchor rect for the bubble/ring; null = bottom-center fallback.
const tourAnchor = ref<TourAnchorRect | null>(null)
// True when a stop fell back to its altTarget (save step → edit toggle).
const tourUsingAlt = ref(false)
const tourTitle = computed(() => {
  const s = TOUR_STEPS[tourStep.value]
  return s ? pickCopy(s.titleZh, s.titleEn) : ''
})
const tourBody = computed(() => {
  const s = TOUR_STEPS[tourStep.value]
  if (!s) return ''
  if (tourUsingAlt.value && s.altBodyZh !== undefined) {
    return pickCopy(s.altBodyZh, s.altBodyEn ?? s.bodyEn)
  }
  return pickCopy(s.bodyZh, s.bodyEn)
})
const tourShortcut = computed(() => TOUR_STEPS[tourStep.value]?.shortcut || '')

function queryTourTarget(selector: string): TourAnchorRect | null {
  let el: Element | null = null
  try {
    el = selector ? document.querySelector(selector) : null
  } catch {
    return null
  }
  if (!el) return null
  let r: DOMRect
  try {
    r = el.getBoundingClientRect()
  } catch {
    return null
  }
  // Hidden or collapsed targets (closed sidebar, edit-only buttons) fall back.
  if (!r || r.width < 4 || r.height < 4) return null
  try {
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
      return null
    }
  } catch {
    // Viewport check is best-effort only.
  }
  // T24: target's own corner radius drives the spotlight cutout shape.
  let radius: number | null = null
  try {
    radius = parseBorderRadiusToPx(window.getComputedStyle(el).borderRadius || '', r.width, r.height)
  } catch {
    radius = null
  }
  return { x: r.x, y: r.y, width: r.width, height: r.height, radius }
}

function updateTourAnchor() {
  if (!tourVisible.value) return
  const s = TOUR_STEPS[tourStep.value]
  if (!s) {
    tourAnchor.value = null
    tourUsingAlt.value = false
    return
  }
  const primary = queryTourTarget(s.target)
  if (primary) {
    tourAnchor.value = primary
    tourUsingAlt.value = false
    return
  }
  if (s.altTarget) {
    const alt = queryTourTarget(s.altTarget)
    if (alt) {
      tourAnchor.value = alt
      tourUsingAlt.value = true
      return
    }
  }
  tourAnchor.value = null
  tourUsingAlt.value = false
}

let tourRecalcTimer: ReturnType<typeof setTimeout> | null = null
function scheduleTourAnchorUpdate() {
  if (!tourVisible.value) return
  if (tourRecalcTimer !== null) clearTimeout(tourRecalcTimer)
  tourRecalcTimer = setTimeout(() => {
    tourRecalcTimer = null
    void nextTick().then(() => updateTourAnchor())
  }, 120)
}
function handleTourViewportChange() {
  scheduleTourAnchorUpdate()
}
function startTour() {
  suppressScrollSave = true
  tourStep.value = 0
  tourVisible.value = true
  window.addEventListener('resize', handleTourViewportChange)
  window.addEventListener('scroll', handleTourViewportChange, { passive: true })
  void nextTick().then(() => updateTourAnchor())
}
function finishTour() {
  tourVisible.value = false
  suppressScrollSave = false
  tourAnchor.value = null
  tourUsingAlt.value = false
  if (tourRecalcTimer !== null) {
    clearTimeout(tourRecalcTimer)
    tourRecalcTimer = null
  }
  window.removeEventListener('resize', handleTourViewportChange)
  window.removeEventListener('scroll', handleTourViewportChange)
  void setSeenFlag(SEEN_TOUR_KEY)
}
function tourNext() {
  if (tourStep.value >= TOUR_STEPS.length - 1) {
    finishTour()
  } else {
    tourStep.value += 1
    void nextTick().then(() => updateTourAnchor())
  }
}
function tourPrev() {
  if (tourStep.value > 0) {
    tourStep.value -= 1
    void nextTick().then(() => updateTourAnchor())
  }
}
// The save stop resolves dynamically (save button vs edit toggle): re-anchor
// when edit mode flips mid-tour. No-op while the tour is hidden.
watch(isEditMode, () => {
  scheduleTourAnchorUpdate()
})

// R2 save-back nudge: shown once when a save reaches the manual-authorization
// path (no silent handle, no native host). Dismissible forever.
const saveNudgeVisible = ref(false)
const saveNudgeText = computed(() =>
  pickCopy(
    '直接写回需要先授权。想以后免弹窗保存，可安装本机写入助手（见 native-host 说明）。',
    'Writing back needs a one-time authorization. To skip dialogs entirely, install the native host helper (see native-host docs).'
  )
)
const saveNudgeDismissLabel = computed(() => pickCopy('不再提示', 'Don’t remind me'))
function dismissSaveNudge() {
  saveNudgeVisible.value = false
  void setSeenFlag(SEEN_SAVE_NUDGE_KEY)
}

// Auto-reload on file change (P1-1): opt-in via settings, local files only.
// Rendering goes through the same-document handleContentChange path, so the
// live scroll offset is preserved; edit mode / unsaved changes pause polling.
let docWatcher: DocWatcherHandle | null = null

function isDocWatcherPaused() {
  return isEditMode.value || isDirty.value || pendingSwitchHref !== null
}

function handleExternalDocChange(fresh: string, baseline: DocWatcherSnapshot) {
  // Stale-fetch guard: a save, edit, or document switch that landed while
  // the poll was in flight owns the view now — drop this result.
  if (baseline.href !== currentActiveHref.value) return
  if (baseline.content !== rawMarkdownContent.value) return
  if (isEditMode.value || isDirty.value) return
  void handleContentChange(fresh).then(() => {
    showToast('🔄 检测到文件变更，已自动重新加载')
  })
}

function syncDocWatcher() {
  const want = settings.value.autoReload === true && isLocal.value
  if (want && !docWatcher) {
    docWatcher = startDocWatcher({
      fetchContent: fetchDocContent,
      getSnapshot: () => ({ href: currentActiveHref.value, content: rawMarkdownContent.value }),
      isPaused: isDocWatcherPaused,
      isEnabled: () => settings.value.autoReload === true && isLocal.value,
      onExternalChange: handleExternalDocChange
    })
    // Newly enabled: check immediately instead of waiting one interval.
    docWatcher.checkNow()
  } else if (!want && docWatcher) {
    docWatcher.stop()
    docWatcher = null
  }
}

function toggleEditMode() {
  if (isEditMode.value) {
    finishInPlaceEdit()
  } else {
    isEditMode.value = true
    showToast('✏️ 已开启原地所见即所得编辑模式，可直接在页面上修改')
  }
}

async function handleInPlaceInput() {
  isDirty.value = true
  await refreshOutline()
}

// 大纲异步刷新带序号守卫：快速连续输入时丢弃过期结果，避免乱序覆盖
let outlineSeq = 0
async function refreshOutline() {
  if (!contentRef.value) return
  const seq = ++outlineSeq
  const result = await extractOutline(contentRef.value, settings.value.maxOutlineExpandLevel)
  if (seq === outlineSeq) {
    outlineData.value = result
    renderTocContainer(result.list)
  }
}

async function saveInPlace(): Promise<boolean> {
  if (!contentRef.value) return false
  // 无修改时跳过写盘，避免无意义的磁盘写入
  if (!isDirty.value) {
    showToast('没有需要保存的修改')
    return true
  }
  const newMarkdown = await domToMarkdown(contentRef.value)
  const fileUrl = currentActiveHref.value
  const fileName = decodeURIComponent(fileUrl.split('/').pop() || 'document.md')

  // 1. 静默保存：已授权的文件句柄优先，其次已授权目录句柄（覆盖原文件，绝不新建）
  try {
    const silentSuccess = (await trySilentSave(fileUrl, newMarkdown)) || (await trySilentSaveViaDirectory(fileUrl, newMarkdown))
    if (silentSuccess) {
      rawMarkdownContent.value = newMarkdown
      isDirty.value = false
      showToast('✓ 已直接静默覆盖保存至原文件')
      return true
    }
  } catch (e) {
    console.warn('Silent save check error:', e)
  }

  // 2. 本机写入宿主（Native Messaging）：已安装时直接覆盖原文件，零弹窗
  try {
    if (await tryNativeSave(fileUrl, newMarkdown)) {
      rawMarkdownContent.value = newMarkdown
      isDirty.value = false
      showToast('✓ 已覆盖保存至原文件')
      return true
    }
  } catch (e) {
    console.warn('Native save error:', e)
  }

  // 3. 首次授权：让用户选择文档所在文件夹（readwrite）。
  //    目录句柄持久化后，该文件夹内所有文件均静默覆盖保存，不再弹任何对话框。
  // R2 save-back nudge: silent + native both unavailable — surface the
  // dialog-free native-host option once (dismissible, non-blocking).
  if (!(await hasSeenFlag(SEEN_SAVE_NUDGE_KEY))) {
    saveNudgeVisible.value = true
  }
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'markcraft-workspace' })
      const dirUrl = fileUrl.substring(0, fileUrl.lastIndexOf('/') + 1) || fileUrl
      // create:false：选中的文件夹里必须已存在同名文件，防止误存到错误位置
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: false })
      const ok = await writeToFileHandle(fileHandle, newMarkdown)
      if (ok) {
        await storeDirectoryHandle(dirUrl, dirHandle)
        await storeFileHandle(fileUrl, fileHandle)
        rawMarkdownContent.value = newMarkdown
        isDirty.value = false
        showToast('✓ 已覆盖保存原文件；此文件夹后续将静默保存')
        return true
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        showToast('✕ 已取消保存')
        return false
      }
      // 选错文件夹（不含当前文档）等情况 → 回退到单文件对话框
      console.warn('Directory authorization fallback:', err)
    }
  }

  // 4. 兜底：单文件另存对话框（文件名已预填）
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'Markdown Document',
          accept: { 'text/markdown': ['.md', '.markdown'] }
        }]
      })
      if (handle) {
        await storeFileHandle(fileUrl, handle)

        const ok = await writeToFileHandle(handle, newMarkdown)
        if (ok) {
          rawMarkdownContent.value = newMarkdown
          isDirty.value = false
          showToast('✓ 文件已授权并保存，后续将直接静默保存')
          return true
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      showToast('✕ 已取消保存')
      return false
    }
    console.warn('File save error:', err)
    showToast('✕ 保存失败: ' + (err.message || '未知错误'))
    return false
  }

  return false
}

async function finishInPlaceEdit() {
  if (isDirty.value && contentRef.value) {
    const saved = await saveInPlace()
    if (!saved) {
      // User cancelled save dialog
      return
    }
  }

  if (contentRef.value) {
    const newMarkdown = await domToMarkdown(contentRef.value)
    rawMarkdownContent.value = newMarkdown
    // Exiting edit mode re-renders: preserve the live offset across the DOM swap.
    const liveY = readCurrentScrollY()
    await updateMarkdown(newMarkdown)
    window.scrollTo(0, liveY)
    updateReadingProgress()
  }
  isEditMode.value = false
  isDirty.value = false
  showToast('✓ 已退出编辑模式')
}

function cancelInPlaceEdit() {
  // Discarding edits re-renders from the saved markdown: keep the live offset.
  const liveY = readCurrentScrollY()
  void updateMarkdown(rawMarkdownContent.value).then(() => {
    window.scrollTo(0, liveY)
    updateReadingProgress()
  })
  isEditMode.value = false
  isDirty.value = false
  showToast('✕ 已放弃未保存的修改')
}

function toggleTheme() {
  const sequence: Array<'auto' | 'light' | 'sepia' | 'verdant' | 'dark' | 'nordic' | 'dracula'> = [
    'auto',
    'light',
    'sepia',
    'verdant',
    'dark',
    'nordic',
    'dracula'
  ]
  const curIdx = sequence.indexOf(currentTheme.value)
  const next = sequence[(curIdx + 1) % sequence.length]
  currentTheme.value = next
  applyTheme(next)
  void rerenderMermaidDiagrams()
  // 必须复用同一 useStorage 实例：新建实例会以默认设置整体写回，
  // 覆盖用户已保存的字体/宽度/插件等设置
  void saveSettings({ pageTheme: next })
}

// URL-synced document switch (Bug3 fix): every in-place document change goes
// through here so the address bar, history, sidebar highlight and scroll
// restore stay consistent. `content` skips the fetch when the caller already
// has it (sidebar in-memory path); `anchor` jumps to a heading afterwards
// (shared section links win over the remembered offset).
let pendingSwitchHref: string | null = null
async function switchToDocument(
  href: string,
  content?: string,
  opts?: { replace?: boolean; anchor?: string | null }
): Promise<void> {
  if (!href) return
  if (isSameDocument(href, currentActiveHref.value) && content === undefined) return
  if (pendingSwitchHref === href) return
  pendingSwitchHref = href
  try {
    let raw = content
    if (raw === undefined) {
      raw = await fetchDocContent(href)
      if (raw === null) {
        // bg-fetch failed (e.g. no file access): full navigation lets the
        // browser show the real document / error instead of a blank reader.
        window.location.href = href
        return
      }
    }
    await handleContentChange(raw, href, { replace: opts?.replace })
    sideRef.value?.setActiveHref(href)
    if (opts?.anchor) void scrollToAnchorWithRetry(opts.anchor, href)
  } finally {
    if (pendingSwitchHref === href) pendingSwitchHref = null
  }
}

// R8 direct-to-section: retry the anchor jump while async layout settles
// (Mermaid/images shift offsets after first paint). Aborts when a newer
// document switch takes over the viewport.
const ANCHOR_RETRY_DELAYS_MS = [0, 120, 350, 800, 1500]
const ANCHOR_HEADER_OFFSET = 54
function findAnchorElement(anchor: string): HTMLElement | null {
  // DOM ids hold the ENCODED slug (extractOutline writes href.slice(1)), so
  // try the literal anchor first; the decoded form is a legacy fallback
  // (pre-R8 scrollToAnchor decoded unconditionally, breaking CJK jumps).
  let raw = ''
  try {
    raw = anchor.replace(/^#+/, '')
  } catch {
    return null
  }
  if (!raw) return null
  const candidates = [raw]
  try {
    const decoded = decodeURIComponent(raw)
    if (decoded && decoded !== raw) candidates.push(decoded)
  } catch {
    // Malformed escape: literal-only lookup.
  }
  for (const id of candidates) {
    try {
      const el = document.getElementById(id)
      if (el) return el
    } catch {
      // Invalid id characters: try the next candidate.
    }
  }
  return null
}
async function scrollToAnchorWithRetry(anchor: string, docHref?: string): Promise<void> {
  const expected = docHref || currentActiveHref.value
  for (let i = 0; i < ANCHOR_RETRY_DELAYS_MS.length; i += 1) {
    if (currentActiveHref.value !== expected) return
    const delay = ANCHOR_RETRY_DELAYS_MS[i]
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    } else {
      await nextTick()
    }
    if (currentActiveHref.value !== expected) return
    const el = findAnchorElement(anchor)
    if (!el) continue
    const elementPosition = el.getBoundingClientRect().top
    // Settled when the heading sits just under the fixed header.
    if (Math.abs(elementPosition - ANCHOR_HEADER_OFFSET) <= 3) return
    window.scrollTo({
      top: Math.max(0, elementPosition + window.pageYOffset - ANCHOR_HEADER_OFFSET),
      behavior: 'auto'
    })
    // Last attempt always applies; earlier ones re-verify after layout shifts.
    if (i === ANCHOR_RETRY_DELAYS_MS.length - 1) return
  }
}

function scrollToAnchor(anchor: string) {
  void scrollToAnchorWithRetry(anchor)
}

function handlePaletteSelectFile(item: PaletteItem) {
  if (item.href) {
    void switchToDocument(item.href)
  }
}

function handlePaletteSelectHeading(headingId: string) {
  scrollToAnchor(headingId)
}

async function handlePaletteAction(actionId: string) {
  if (actionId === 'settings') {
    settingsVisible.value = true
  } else if (actionId === 'theme') {
    toggleTheme()
  } else if (actionId === 'raw') {
    // 面板中该指令的 id 为 'raw'（切换原始源码/在线编辑）
    toggleEditMode()
  } else if (actionId === 'fullscreen') {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  } else if (actionId === 'print') {
    window.print()
  } else if (actionId === 'copy-rich') {
    if (contentRef.value) {
      const ok = await copyAsRichText(contentRef.value)
      if (ok) showToast('✓ 已复制富文本排版，可直接粘贴至公众号 / 知乎')
      else showToast('✕ 复制失败，请稍后重试')
    }
  } else if (actionId === 'export-html') {
    const docTitle = document.title || 'MarkCraft-Export'
    // Live-element export: rendered Mermaid SVGs + inlined images + sanitize.
    // Falls back to the string entry when the article node is unavailable.
    if (contentRef.value) {
      const ok = await exportElementAsStandaloneHtml(docTitle, contentRef.value)
      showToast(ok ? '✓ 已成功导出单文件 HTML' : '✕ 导出失败，请稍后重试')
    } else {
      exportAsStandaloneHtml(docTitle, renderedHtml.value)
      showToast('✓ 已成功导出单文件 HTML')
    }
  } else if (actionId === 'export-md') {
    const docTitle = document.title || 'document'
    const md = contentRef.value && isEditMode.value ? await domToMarkdown(contentRef.value) : rawMarkdownContent.value
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docTitle.replace(/[/\\?%*:|"<>]/g, '_')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('✓ 已成功下载 Markdown 文件')
  }
}

// Back/forward through in-place switches (history.pushState): treat it as a
// document switch with the same save-old / restore-new ordering. The state
// carries the exact doc href; when it is missing (initial entry, hash-route
// traversal) the pointer is re-parsed from the location instead.
function handlePopState(e: PopStateEvent) {
  const state = (e.state || {}) as { mdrHref?: unknown; href?: unknown }
  // `mdrHref` is the current shape; legacy `href` entries predate the fix.
  const stateHref = typeof state.mdrHref === 'string' && state.mdrHref
    ? state.mdrHref
    : typeof state.href === 'string' && state.href
      ? state.href
      : null
  const parsed = parseDocUrl(window.location.href)
  const target = stateHref || parsed.docHref || window.location.href.split('#')[0]
  if (!target || isSameDocument(target, currentActiveHref.value) || pendingSwitchHref === target) return
  void switchToDocument(target, undefined, { anchor: parsed.anchor })
}

// Back/forward through hash-route entries fires popstate too; the guards make
// the second event a no-op. Manual hash edits to #mdr-doc=… also land here.
// Plain heading anchors are ignored so in-page jumps keep working.
function handleHashChange() {
  const parsed = parseDocUrl(window.location.href)
  if (!parsed.docHref) return
  if (isSameDocument(parsed.docHref, currentActiveHref.value) || pendingSwitchHref === parsed.docHref) return
  void switchToDocument(parsed.docHref, undefined, { anchor: parsed.anchor })
}

function flushCurrentScroll() {
  flushScrollPosition(currentActiveHref.value)
  recordReadingSnapshot(currentActiveHref.value)
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    flushScrollPosition(currentActiveHref.value)
    recordReadingSnapshot(currentActiveHref.value)
  }
}
function handleGlobalKeydown(e: KeyboardEvent) {
  // 焦点在可编辑元素时归还按键，避免劫持宿主页/扩展自身输入框的文本操作；
  // 扩展 UI 内仅保留搜索面板的 Cmd+K 与编辑画布中的 Cmd+S
  const target = e.target as HTMLElement | null
  const isEditable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  if (isEditable) {
    const appRoot = document.getElementById('mdr-root')
    const inApp = !!appRoot && !!target && appRoot.contains(target)
    const isMeta = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    const allowToggleSearch = inApp && isMeta && key === 'k'
    const inEditor = inApp && !!contentRef.value && (target === contentRef.value || contentRef.value.contains(target))
    const allowSave = inEditor && isMeta && key === 's'
    // R5 RAW toggle is allowed from inputs too (it never steals text).
    const allowRaw = inApp && isMeta && e.shiftKey && key === 'm'
    if (!allowToggleSearch && !allowSave && !allowRaw) return
  }

  const isMeta = e.metaKey || e.ctrlKey
  if (isMeta && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchVisible.value = !searchVisible.value
  } else if (isMeta && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    leftSideOpen.value = !leftSideOpen.value
  } else if (isMeta && e.key.toLowerCase() === 'u') {
    e.preventDefault()
    rightSideOpen.value = !rightSideOpen.value
  } else if (isMeta && e.key.toLowerCase() === 'e') {
    e.preventDefault()
    toggleEditMode()
  } else if (isMeta && e.shiftKey && e.key.toLowerCase() === 'm') {
    // R5: RAW source toggle (manifest commands use Alt+Shift+*; no clash).
    e.preventDefault()
    toggleRawView()
  } else if (isMeta && e.key.toLowerCase() === 's') {
    if (isEditMode.value) {
      e.preventDefault()
      saveInPlace()
    }
  } else if (isMeta && e.key === ',') {
    e.preventDefault()
    settingsVisible.value = !settingsVisible.value
  } else if (e.altKey && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    handlePaletteAction('copy-rich')
  } else if (e.altKey && e.key.toLowerCase() === 'h') {
    e.preventDefault()
    handlePaletteAction('export-html')
  }
}

// 弹窗 / 设置页修改 chrome.storage.local 后广播到所有上下文，这里实时应用，
// 免去手动刷新页面。主题/字体/宽度/自定义 CSS 为纯样式切换；插件集合变化需
// 重渲染——编辑模式下跳过（避免冲掉未保存修改），退出编辑时会带新设置重渲染。
function handleStorageChanges(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (area !== 'local' || !changes.settings) return
  const next = normalizeSettings(changes.settings.newValue)
  const pluginsChanged = JSON.stringify(next.mdPlugins) !== JSON.stringify(settings.value.mdPlugins)
  const themeChanged = next.pageTheme !== settings.value.pageTheme
  settings.value = next
  // Auto-reload toggle may have flipped (settings modal / popup / options).
  syncDocWatcher()
  // 同步顶栏主题图标（弹窗/其他标签页修改时本页 currentTheme 不会自动更新）
  currentTheme.value = next.pageTheme
  applyTheme(next.pageTheme)
  if (themeChanged) {
    // 主题变化后立即以新配色重绘已渲染的 Mermaid 图表（设置即时生效）
    void rerenderMermaidDiagrams()
  }
  applyCustomStyles(
    next.enableCustomCSS ? next.customCSS : undefined,
    next.enableCustomContentWidth ? next.customContentWidth : undefined,
    next.textFont,
    next.textSize
  )
  if (pluginsChanged && !isEditMode.value) {
    void updateMarkdown(rawMarkdownContent.value)
  }
}

onMounted(async () => {
  try {
    // We own scroll restoration per document; the browser default would fight
    // restoreDocScroll() on reloads and in-place switches.
    history.scrollRestoration = 'manual'
  } catch {}
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
  window.addEventListener('popstate', handlePopState)
  window.addEventListener('hashchange', handleHashChange)
  window.addEventListener('pagehide', flushCurrentScroll)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  updateReadingProgress()
  await loadSettings()
  // Start the file-change watcher when opted in (local files only).
  syncDocWatcher()
  currentTheme.value = settings.value.pageTheme || 'auto'
  applyTheme(currentTheme.value)
  applyCustomStyles(
    settings.value.enableCustomCSS ? settings.value.customCSS : undefined,
    settings.value.enableCustomContentWidth ? settings.value.customContentWidth : undefined,
    settings.value.textFont,
    settings.value.textSize
  )

  await updateMarkdown(props.initialContent)
  // Initial doc resolution (Bug3): a pasted / shared URL may point at a
  // different document than the loaded file — via a full URL (navigation
  // already handled it) or via a ?mdr-doc= / #mdr-doc= pointer (resolve it
  // now, replacing the entry so refresh stays consistent). Doc-first: the
  // switch renders + syncs the URL + restores that document's scroll, so the
  // plain reload path below only runs when no pointer exists.
  const initial = parseDocUrl(window.location.href)
  if (initial.docHref && !isSameDocument(initial.docHref, currentActiveHref.value)) {
    await switchToDocument(initial.docHref, undefined, { replace: true, anchor: initial.anchor })
  } else if (initial.anchor) {
    // R8: an explicit section fragment (pasted/shared section link) wins over
    // the remembered offset — TOC clicks never write hashes, so a present
    // anchor always means section intent.
    await scrollToAnchorWithRetry(initial.anchor)
  } else {
    // First paint: resume this document's remembered place (reload case),
    // otherwise start at the top.
    await restoreDocScroll(currentActiveHref.value, scrollSwitchSeq)
  }
  // R6: warm the recents store and record this launch as a visit so reloads
  // keep the document pinned in 最近 / palette.
  void ensureRecentsLoaded().then(() => {
    touchRecent(currentActiveHref.value, { scrollY: readCurrentScrollY(), progress: readingProgress.value })
  })

  if (window.innerWidth < 1100) {
    rightSideOpen.value = false
  }

  // R2 tour: first run only, after the document (and its scroll) settled.
  if (!(await hasSeenFlag(SEEN_TOUR_KEY))) {
    startTour()
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChanges)
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'command') {
      if (msg.command === 'toggleSide') leftSideOpen.value = !leftSideOpen.value
      if (msg.command === 'togglePageTheme') toggleTheme()
    }
  })
})

onUnmounted(() => {
  flushCurrentScroll()
  if (docWatcher) {
    docWatcher.stop()
    docWatcher = null
  }
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('popstate', handlePopState)
  window.removeEventListener('hashchange', handleHashChange)
  window.removeEventListener('pagehide', flushCurrentScroll)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(handleStorageChanges)
  }
})
</script>

<style scoped>
/* R5 RAW source view: plain pre over the held markdown, theme-aware */
.mdr-raw-view {
  margin: 0;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-subtle);
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

/* In-Place WYSIWYG Editing Styles */
.mdr-in-place-editing {
  outline: none;
  cursor: text;
}

.mdr-in-place-editing :deep(p),
.mdr-in-place-editing :deep(h1),
.mdr-in-place-editing :deep(h2),
.mdr-in-place-editing :deep(h3),
.mdr-in-place-editing :deep(h4),
.mdr-in-place-editing :deep(h5),
.mdr-in-place-editing :deep(h6),
.mdr-in-place-editing :deep(blockquote),
.mdr-in-place-editing :deep(pre),
.mdr-in-place-editing :deep(table),
.mdr-in-place-editing :deep(ul),
.mdr-in-place-editing :deep(ol) {
  position: relative;
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
  border-radius: 4px;
}

.mdr-in-place-editing :deep(p:hover),
.mdr-in-place-editing :deep(h1:hover),
.mdr-in-place-editing :deep(h2:hover),
.mdr-in-place-editing :deep(h3:hover),
.mdr-in-place-editing :deep(blockquote:hover),
.mdr-in-place-editing :deep(pre:hover),
.mdr-in-place-editing :deep(table:hover) {
  box-shadow: 0 0 0 1px var(--border-color);
}

.mdr-in-place-editing :deep(p:focus),
.mdr-in-place-editing :deep(h1:focus),
.mdr-in-place-editing :deep(h2:focus),
.mdr-in-place-editing :deep(h3:focus),
.mdr-in-place-editing :deep(blockquote:focus),
.mdr-in-place-editing :deep(pre:focus),
.mdr-in-place-editing :deep(table:focus) {
  box-shadow: 0 0 0 1.5px var(--primary-color) !important;
  background-color: var(--bg-hover);
  outline: none;
}
</style>
