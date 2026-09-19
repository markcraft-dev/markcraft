<template>
  <aside
    ref="sideRef"
    class="mdr-side fixed bottom-0 left-0 top-44px z-30 flex flex-col bg-[--bg-sidebar] text-[--text-primary] border-r border-[--border-color] select-none print:hidden shadow-xs transition-[width,transform] duration-200"
    :style="{ width: `${sideWidth}px` }"
  >
    <!-- Header: Workspace Title + Search Button (extension style) -->
    <div class="mdr-side__head p-10px px-14px border-b border-[--border-color] flex items-center justify-between bg-[--bg-sidebar]">
      <!-- Top Row: Workspace Brand -->
      <div class="flex items-center gap-7px min-w-0">
        <IconLogo class="w-18px h-18px flex-shrink-0" />
        <span class="text-13px font-bold text-[--text-primary] truncate tracking-tight">{{ currentDirName || '资源管理器' }}</span>
      </div>

      <!-- Quick Search Button -->
      <IconButton
        title="搜索文件"
        shortcut="⌘K"
        @click="$emit('open-search')"
      >
        <SvgIcon name="search" class="w-3.5 h-3.5"  />
      </IconButton>
    </div>

    <!-- Main Content List (Folder Tree) -->
    <div class="mdr-side__content flex-1 overflow-y-auto overflow-x-hidden p-8px">
      <!-- Section Label (extension style) -->
      <div class="px-8px py-4px text-11px font-medium text-[--text-muted] uppercase tracking-wider flex items-center justify-between">
        <span>项目目录</span>
      </div>

      <!-- Parent Directory Navigation Item with Explicit High-Contrast Hover -->
      <div
        v-if="parentDirUrl"
        class="parent-dir-row group flex items-center gap-7px py-5px px-8px mb-4px rounded-lg cursor-pointer text-12px text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors select-none"
        title="返回上一级目录"
        @click="navigateParentDir"
      >
        <SvgIcon name="corner-left-up" class="w-3.5 h-3.5 flex-shrink-0 text-[--text-muted] group-hover:text-[--text-primary] transition-colors"  />
        <span class="truncate font-medium">.. 返回上一级</span>
      </div>

      <!-- R6 最近 group: newest-first, workspace-scoped; resume via normal switch -->
      <div v-if="workspaceRecents.length > 0" class="mb-4px">
        <div class="px-8px py-4px text-11px font-medium text-[--text-muted] uppercase tracking-wider">
          <span>最近阅读</span>
        </div>
        <TreeNode
          v-for="item in workspaceRecents"
          :key="item.id || item.href"
          :item="item"
          :progress-map="progressMap"
          @toggle="handleFolderToggle"
          @select="handleFileSelect"
          @open-new-tab="handleOpenNewTab"
        />
      </div>

      <!-- Loading State: skeleton rows while the first directory fetch is in flight.
        file:// 冷启动时 SW 尚未唤醒会有数百毫秒重试窗口，此前版本直接显示空态造成“随机为空”错觉 -->
      <div v-if="isLoading" class="flex flex-col gap-6px p-4px" aria-label="正在加载目录" aria-busy="true">
        <div v-for="i in 6" :key="i" class="h-22px rounded-lg bg-[--bg-hover] opacity-60 animate-pulse" :style="{ width: `${92 - i * 7}%` }"></div>
        <span class="px-8px py-4px text-11px text-[--text-muted]">正在加载目录…</span>
      </div>

      <!-- Load Failure State: distinct from a genuinely empty folder.
        常见原因是未开启「允许访问文件网址」或 SW 冷启动仍失败，提供重试入口 -->
      <div v-else-if="loadError" class="flex flex-col items-center justify-center p-24px text-center text-12px text-[--text-muted]">
        <SvgIcon name="folder" class="w-8 h-8 mb-8px opacity-25 text-[--text-muted]"  />
        <span class="font-medium text-[--text-secondary] mb-4px">目录加载失败</span>
        <span class="mb-8px leading-relaxed">{{ loadError }}</span>
        <span class="mb-12px leading-relaxed opacity-80">请确认已在 chrome://extensions → MarkCraft 详情页开启「允许访问文件网址」</span>
        <button
          class="px-12px py-6px rounded-lg text-12px font-medium cursor-pointer border border-[--border-color] bg-[--bg-hover] text-[--text-primary] hover:opacity-85 transition-opacity"
          @click="retryLoad"
        >
          重试
        </button>
      </div>

      <!-- No-file-access guide (R2 heuristic, 4th state): local + empty + no
        failure most likely means "Allow access to file URLs" is off. The copy
        covers the genuinely-empty case too ("dismiss if you already enabled
        it"); once dismissed we fall through to the plain empty state. -->
      <div v-else-if="showNoFileAccess" class="rounded-xl border border-[--border-color] bg-[--bg-subtle]/50 mx-2px">
        <OnboardingCard @dismiss="dismissFileAccessHint" />
      </div>

      <!-- Empty Folder State (only when load succeeded but no Markdown found) -->
      <div v-else-if="folderTree.length === 0" class="flex flex-col items-center justify-center p-32px text-center text-12px text-[--text-muted]">
        <SvgIcon name="folder" class="w-8 h-8 mb-8px opacity-25 text-[--text-muted]"  />
        <span>当前目录下未找到 Markdown 文件</span>
      </div>

      <!-- Tree Nodes -->
      <TreeNode
        v-for="item in folderTree"
        :key="item.id || item.href"
        :item="item"
        :progress-map="progressMap"
        @toggle="handleFolderToggle"
        @select="handleFileSelect"
        @open-new-tab="handleOpenNewTab"
      />
    </div>

    <!-- Bottom Action Status Footer -->
    <div class="p-8px px-12px border-t border-[--border-color] bg-[--bg-sidebar] flex items-center justify-between text-12px select-none">
      <button
        class="flex items-center gap-6px text-[--text-secondary] hover:text-[--text-primary] transition-colors cursor-pointer border-0 outline-none bg-transparent font-medium"
        title="偏好设置 (⌘,)"
        @click="$emit('open-settings')"
      >
        <SvgIcon name="settings" class="w-3.5 h-3.5 text-[--text-muted]"  />
        <span>设置</span>
      </button>

      <span class="font-mono text-11px font-medium text-[--text-muted]">v1.0.1</span>
    </div>

    <!-- Drag Splitter -->
    <div
      class="mdr-side__splitter absolute right-0 top-0 bottom-0 w-3px cursor-col-resize hover:bg-[--primary-color] transition-colors"
      title="拖动调整文件列表宽度"
      @mousedown="startResize"
    ></div>
  </aside>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TreeNode from './TreeNode.vue'
import IconButton from '@/components/IconButton.vue'
import IconLogo from '@/components/icons/IconLogo.vue'
import { fetchDirectory, getParentFolderURL, resolveAncestorFolderURLs, hasDirectoryReadFailure, getLastDirectoryError, clearDirectoryCache } from '../core/folder'
import OnboardingCard from './OnboardingCard.vue'
import { hasSeenFlag, hasSeenFlagSync, setSeenFlag, SEEN_FILE_ACCESS_HINT_KEY } from '../core/onboarding'
import { ensureRecentsLoaded, getRecents, subscribeRecents, type RecentDoc } from '../core/recents'
import { normalizeScrollKey } from '../core/scroll-memory'
import type { TreeNodeItem } from '@/shared/types'

const STORAGE_ROOT_KEY = 'markcraft_workspace_root'
const STORAGE_EXPANDED_KEY = 'markcraft_expanded_folders'

const props = withDefaults(
  defineProps<{
    isLocal?: boolean
    width?: number
  }>(),
  {
    isLocal: true,
    width: 260
  }
)

const emit = defineEmits<{
  (e: 'changeRaw', content: string, href: string): void
  (e: 'open-settings'): void
  (e: 'open-search'): void
  (e: 'update:width', val: number): void
  (e: 'tree-loaded', nodes: TreeNodeItem[]): void
}>()

const sideRef = ref<HTMLElement | null>(null)
const sideWidth = ref(props.width)
const folderTree = ref<TreeNodeItem[]>([])
const currentWorkspaceRoot = ref('')
const activeHref = ref(window.location.href)
// R6/R9: recents store snapshot for the 最近 group + tree resume badges.
// progressMap keys are normalizeScrollKey hrefs (hash-stripped).
const recentDocs = ref<RecentDoc[]>([])
const progressMap = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  for (const r of recentDocs.value) map[r.key] = r.progress
  return map
})
// 最近 group: workspace-scoped (prefix match on the current root), newest
// first; clicking one switches + resumes via the normal scroll-memory path,
// so "continue reading" needs no separate affordance beyond the % badge.
const workspaceRecents = computed<TreeNodeItem[]>(() => {
  const root = currentWorkspaceRoot.value || getParentFolderURL()
  return recentDocs.value
    .filter((r) => r.href.startsWith(root))
    .slice(0, 6)
    .map((r) => ({
      id: `recent-${normalizeScrollKey(r.href)}`,
      content: r.title,
      isFolder: false,
      href: r.href,
      active: normalizeScrollKey(r.href) === normalizeScrollKey(activeHref.value)
    }))
})
let unsubscribeRecents: (() => void) | null = null
// 加载态 / 失败态与空目录态三分：避免首屏竞态下把“还没回来”渲染成“没有文件”
const isLoading = ref(false)
const loadError = ref('')
// 串行化初始化：快速切换目录/重复挂载时丢弃过期轮次的结果，避免后到的旧响应覆盖新目录
let loadSeq = 0
// R2 file-access heuristic: default to dismissed for first paint (no flash of
// the guide for users who already dismissed it), then reveal when the async
// storage read proves otherwise.
const fileAccessHintDismissed = ref(hasSeenFlagSync(SEEN_FILE_ACCESS_HINT_KEY))
const showNoFileAccess = computed(() => props.isLocal && !fileAccessHintDismissed.value)

function dismissFileAccessHint() {
  fileAccessHintDismissed.value = true
  void setSeenFlag(SEEN_FILE_ACCESS_HINT_KEY)
}

function getSavedRoot(): string {
  try {
    return sessionStorage.getItem(STORAGE_ROOT_KEY) || ''
  } catch {
    return ''
  }
}

function saveSavedRoot(root: string) {
  try {
    sessionStorage.setItem(STORAGE_ROOT_KEY, root)
  } catch {}
}

function getSavedExpanded(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_EXPANDED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveExpanded(expandedSet: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_EXPANDED_KEY, JSON.stringify(Array.from(expandedSet)))
  } catch {}
}

const currentDirName = computed(() => {
  const cur = currentWorkspaceRoot.value || getParentFolderURL()
  const clean = cur.replace(/\/$/, '')
  const parts = clean.split('/')
  return decodeURIComponent(parts[parts.length - 1] || '资源管理器')
})

const parentDirUrl = computed(() => {
  const currentDir = currentWorkspaceRoot.value || getParentFolderURL()
  const trimmed = currentDir.endsWith('/') ? currentDir.slice(0, -1) : currentDir
  const lastSlash = trimmed.lastIndexOf('/')
  if (lastSlash > 'file://'.length) {
    return `${trimmed.substring(0, lastSlash)}/`
  }
  return ''
})

function navigateParentDir() {
  if (parentDirUrl.value) {
    currentWorkspaceRoot.value = parentDirUrl.value
    saveSavedRoot(parentDirUrl.value)
    loadFolderTree(parentDirUrl.value)
  }
}

async function loadFolderTree(url?: string) {
  const seq = ++loadSeq
  isLoading.value = true
  loadError.value = ''
  let root = url
  if (!root) {
    const saved = getSavedRoot()
    if (saved && window.location.href.startsWith(saved)) {
      root = saved
    } else {
      root = getParentFolderURL()
      saveSavedRoot(root)
    }
  }
  currentWorkspaceRoot.value = root

  try {
    const expanded = getSavedExpanded()

    const ancestors = await resolveAncestorFolderURLs(root, activeHref.value)
    if (seq !== loadSeq) return
    ancestors.forEach((a) => expanded.add(a))
    saveExpanded(expanded)

    const nodes = await fetchDirectory(root, expanded, activeHref.value)
    if (seq !== loadSeq) return
    folderTree.value = nodes
    if (nodes.length === 0 && hasDirectoryReadFailure()) {
      loadError.value = getLastDirectoryError() || '无法读取本地目录（可能是扩展尚未就绪或缺少文件访问权限）'
      console.error(`[MarkCraft] sidebar directory load failed for ${root}: ${loadError.value}`)
    } else {
      loadError.value = ''
    }
    emit('tree-loaded', nodes)
  } catch (e) {
    if (seq !== loadSeq) return
    const reason = e instanceof Error ? e.message : String(e)
    loadError.value = reason || '目录加载出现未知错误'
    console.error(`[MarkCraft] sidebar directory load threw for ${root}:`, e)
  } finally {
    if (seq === loadSeq) isLoading.value = false
  }
}

function retryLoad() {
  if (currentWorkspaceRoot.value) clearDirectoryCache(currentWorkspaceRoot.value)
  else clearDirectoryCache()
  void loadFolderTree(currentWorkspaceRoot.value || undefined)
}

async function handleFolderToggle(item: TreeNodeItem) {
  const expanded = getSavedExpanded()
  const folderUrl = item.href.endsWith('/') ? item.href : `${item.href}/`

  if (item.expanded) {
    expanded.add(item.href)
    expanded.add(folderUrl)
    if (!item.children || item.children.length === 0) {
      const subNodes = await fetchDirectory(item.href, expanded, activeHref.value)
      item.children = subNodes
    }
  } else {
    expanded.delete(item.href)
    expanded.delete(folderUrl)
  }
  saveExpanded(expanded)
}

function updateActiveNodeRecursively(nodes: TreeNodeItem[], targetHref: string) {
  nodes.forEach((n) => {
    n.active = n.href === targetHref
    if (n.children && n.children.length > 0) {
      updateActiveNodeRecursively(n.children, targetHref)
    }
  })
}

function setActiveHref(href: string) {
  activeHref.value = href
  updateActiveNodeRecursively(folderTree.value, href)
}

// R6/R9: recents feed the 最近 group + resume badges; subscription refreshes
// badges as snapshots land (debounced writes, so no flicker).
function refreshRecents(list: RecentDoc[]) {
  recentDocs.value = list
}

async function handleFileSelect(item: TreeNodeItem) {
  if (activeHref.value === item.href) {
    return
  }

  activeHref.value = item.href
  updateActiveNodeRecursively(folderTree.value, item.href)

  try {
    const res = await new Promise<{ ok: boolean; res?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: 'bg-fetch', url: item.href }, (r) => resolve(r || { ok: false }))
    })

    if (res && res.ok && res.res !== undefined) {
      // URL + history sync lives in App.handleContentChange so every
      // switch path (sidebar, palette, popstate) stays consistent.
      emit('changeRaw', res.res, item.href)
      return
    }
  } catch (e) {
    console.warn('In-memory load fallback:', e)
  }

  window.location.href = item.href
}

function handleOpenNewTab(item: TreeNodeItem) {
  window.open(item.href, '_blank')
}

function startResize(e: MouseEvent) {
  const startX = e.clientX
  const startWidth = sideWidth.value

  const onMouseMove = (moveEvent: MouseEvent) => {
    const newWidth = Math.max(200, Math.min(600, startWidth + (moveEvent.clientX - startX)))
    sideWidth.value = newWidth
    emit('update:width', newWidth)
    document.documentElement.style.setProperty('--side-width', `${newWidth}px`)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

onMounted(() => {
  if (props.isLocal) {
    loadFolderTree()
    // Reveal the guide card only for users who never dismissed it.
    void hasSeenFlag(SEEN_FILE_ACCESS_HINT_KEY).then((seen) => {
      fileAccessHintDismissed.value = seen
    })
    void ensureRecentsLoaded().then(refreshRecents)
    unsubscribeRecents = subscribeRecents(refreshRecents)
  }
})

onUnmounted(() => {
  unsubscribeRecents?.()
  unsubscribeRecents = null
})

defineExpose({
  loadFolderTree,
  retryLoad,
  setActiveHref,
  getFolderTree: () => folderTree.value
})
</script>
