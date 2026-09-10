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

      <!-- Empty Folder State -->
      <div v-if="folderTree.length === 0" class="flex flex-col items-center justify-center p-32px text-center text-12px text-[--text-muted]">
        <SvgIcon name="folder" class="w-8 h-8 mb-8px opacity-25 text-[--text-muted]"  />
        <span>当前目录下未找到 Markdown 文件</span>
      </div>

      <!-- Tree Nodes -->
      <TreeNode
        v-for="item in folderTree"
        :key="item.id || item.href"
        :item="item"
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

      <span class="font-mono text-11px font-medium text-[--text-muted]">v1.0.0</span>
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
import { ref, computed, onMounted } from 'vue'
import TreeNode from './TreeNode.vue'
import IconButton from '@/components/IconButton.vue'
import IconLogo from '@/components/icons/IconLogo.vue'
import { fetchDirectory, getParentFolderURL, resolveAncestorFolderURLs } from '../core/folder'
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

  const expanded = getSavedExpanded()

  const ancestors = await resolveAncestorFolderURLs(root, activeHref.value)
  ancestors.forEach((a) => expanded.add(a))
  saveExpanded(expanded)

  const nodes = await fetchDirectory(root, expanded, activeHref.value)
  folderTree.value = nodes
  emit('tree-loaded', nodes)
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
      emit('changeRaw', res.res, item.href)
      try {
        history.pushState({ href: item.href }, '', item.href)
      } catch {
        document.title = item.content
      }
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
  }
})

defineExpose({
  loadFolderTree,
  getFolderTree: () => folderTree.value
})
</script>
