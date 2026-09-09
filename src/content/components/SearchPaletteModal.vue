<template>
  <transition name="modal-fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-start justify-center pt-12vh p-16px sm:p-24px bg-black/35 backdrop-blur-[3px] select-none"
      @click.self="$emit('close')"
    >
      <!-- Wide-Screen Responsive Command Palette Card -->
      <div
        class="search-palette w-full max-w-[min(90vw,760px)] bg-[--bg-page] text-[--text-primary] rounded-2xl shadow-2xl border border-[--border-color] flex flex-col overflow-hidden animate-in"
      >
        <!-- Top Prominent Search Input Row -->
        <div class="flex items-center px-18px py-14px border-b border-[--border-color] bg-[--bg-page] gap-12px">
          <IconSearch class="w-5 h-5 text-[--text-muted] flex-shrink-0" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="搜索工程文件、文档章节或快捷指令..."
            class="flex-1 text-15px font-medium bg-transparent border-0 outline-none text-[--text-primary] placeholder-[--text-muted]"
            @keydown.down.prevent="moveSelection(1)"
            @keydown.up.prevent="moveSelection(-1)"
            @keydown.enter.prevent="selectCurrent"
            @keydown.esc="$emit('close')"
          />
          <div class="flex items-center gap-6px">
            <span v-if="query" class="text-11px text-[--text-muted] font-mono mr-4px">
              找到 {{ filteredItems.length }} 项
            </span>
            <span class="text-11px font-mono text-[--text-muted] px-6px py-2px rounded-md bg-[--bg-subtle] border border-[--border-subtle]">ESC 关闭</span>
          </div>
        </div>

        <!-- Scrollable Search Results List -->
        <div class="max-h-[min(58vh,520px)] overflow-y-auto p-10px flex flex-col gap-3px">
          <!-- Files & Outline Section -->
          <div v-if="filteredItems.length > 0">
            <div class="px-12px py-6px text-11px font-semibold text-[--text-muted] uppercase tracking-wider flex items-center justify-between">
              <span>{{ query ? '匹配结果' : '最近与推荐文件' }}</span>
              <span class="text-10px font-normal opacity-70">支持 ↑ ↓ 导航，Enter 确认</span>
            </div>

            <div
              v-for="(item, idx) in filteredItems"
              :key="item.id || item.href"
              class="flex items-center justify-between px-12px py-9px rounded-xl cursor-pointer transition-all select-none group"
              :class="selectedIndex === idx
                ? 'bg-[--bg-active] text-[--text-primary] font-medium shadow-xs ring-1 ring-[--border-color]'
                : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'"
              @mouseenter="selectedIndex = idx"
              @click="handleItemClick(item)"
            >
              <!-- File Name & Path Info -->
              <div class="flex items-center gap-10px min-w-0 flex-1 mr-14px">
                <span class="p-4px rounded-lg bg-[--bg-subtle] flex-shrink-0">
                  <IconFileMarkdown v-if="!item.isHeading" class="w-4 h-4 text-blue-500" />
                  <IconOutline v-else class="w-4 h-4 text-[--primary-color]" />
                </span>

                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-8px">
                    <span class="text-13px font-semibold text-[--text-primary] truncate tracking-tight">{{ item.title }}</span>
                  </div>
                  <span v-if="item.subPath" class="text-11px text-[--text-muted] truncate font-mono mt-1px">
                    {{ item.subPath }}
                  </span>
                </div>
              </div>

              <!-- Action Indicator Pill -->
              <div class="flex items-center gap-6px flex-shrink-0">
                <span
                  v-if="selectedIndex === idx"
                  class="text-11px font-mono text-[--primary-color] px-8px py-3px rounded-md bg-[--primary-light] font-semibold flex items-center gap-4px border border-[--primary-color]/20"
                >
                  ↵ 打开
                </span>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="query" class="flex flex-col items-center justify-center p-36px text-center text-13px text-[--text-muted]">
            <IconSearch class="w-8 h-8 mb-8px opacity-20 text-[--text-muted]" />
            <span>未找到与 “{{ query }}” 相关的 Markdown 文件或章节</span>
          </div>

          <!-- Quick Actions Section -->
          <div class="mt-8px pt-8px border-t border-[--border-subtle]">
            <div class="px-12px py-6px text-11px font-semibold text-[--text-muted] uppercase tracking-wider">
              快捷指令
            </div>

            <div
              v-for="(action, aIdx) in actions"
              :key="action.id"
              class="flex items-center justify-between px-12px py-8px rounded-xl cursor-pointer text-13px transition-all select-none group"
              :class="selectedIndex === filteredItems.length + aIdx
                ? 'bg-[--bg-active] text-[--text-primary] font-medium shadow-xs ring-1 ring-[--border-color]'
                : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'"
              @mouseenter="selectedIndex = filteredItems.length + aIdx"
              @click="handleActionClick(action)"
            >
              <div class="flex items-center gap-10px">
                <span class="p-4px rounded-lg bg-[--bg-subtle] flex-shrink-0 text-[--text-muted] group-hover:text-[--text-primary] transition-colors">
                  <component :is="action.icon" class="w-4 h-4" />
                </span>
                <span class="font-medium">{{ action.title }}</span>
              </div>
              <span class="text-11px font-mono text-[--text-muted] px-6px py-2px rounded-md bg-[--bg-subtle] border border-[--border-subtle]">
                {{ action.shortcut }}
              </span>
            </div>
          </div>
        </div>

        <!-- Footer Bar with Keyboard Hints -->
        <div class="px-16px py-9px border-t border-[--border-color] bg-[--bg-subtle] flex items-center justify-between text-11px text-[--text-muted]">
          <div class="flex items-center gap-14px">
            <span><strong class="font-mono font-medium text-[--text-secondary]">↑ / ↓</strong> 选择</span>
            <span><strong class="font-mono font-medium text-[--text-secondary]">↵</strong> 打开</span>
            <span><strong class="font-mono font-medium text-[--text-secondary]">ESC</strong> 关闭</span>
          </div>
          <span class="font-mono text-10px opacity-60">MarkCraft Quick Open</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import IconSearch from '@/components/icons/IconSearch.vue'
import IconFileMarkdown from '@/components/icons/IconFileMarkdown.vue'
import IconOutline from '@/components/icons/IconOutline.vue'
import IconSettings from '@/components/icons/IconSettings.vue'
import IconSun from '@/components/icons/IconSun.vue'
import IconMaximize from '@/components/icons/IconMaximize.vue'
import IconPrinter from '@/components/icons/IconPrinter.vue'
import IconFileCode from '@/components/icons/IconFileCode.vue'
import IconCopy from '@/components/icons/IconCopy.vue'
import IconDownload from '@/components/icons/IconDownload.vue'
import type { TreeNodeItem, OutlineItem } from '@/shared/types'

export interface PaletteItem {
  id: string
  title: string
  href: string
  subPath?: string
  isHeading?: boolean
}

const props = defineProps<{
  visible: boolean
  files: TreeNodeItem[]
  headings: OutlineItem[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-file', item: PaletteItem): void
  (e: 'select-heading', id: string): void
  (e: 'trigger-action', actionId: string): void
}>()

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const actions = [
  { id: 'copy-rich', title: '一键复制富文本 (微信/知乎排版)', shortcut: '⌥C', icon: IconCopy },
  { id: 'export-html', title: '导出为单文件 HTML (离线排版)', shortcut: '⌥H', icon: IconDownload },
  { id: 'export-md', title: '下载 Markdown 文本文件', shortcut: '⌥S', icon: IconDownload },
  { id: 'settings', title: '打开偏好设置', shortcut: '⌘,', icon: IconSettings },
  { id: 'theme', title: '切换界面明暗主题', shortcut: '⌘T', icon: IconSun },
  { id: 'raw', title: '切换 Markdown 原始源码 / 在线编辑', shortcut: '⌘E', icon: IconFileCode },
  { id: 'fullscreen', title: '全屏沉浸阅读', shortcut: '⌘F', icon: IconMaximize },
  { id: 'print', title: '打印 / 导出 PDF', shortcut: '⌘P', icon: IconPrinter }
]

function flattenTree(nodes: TreeNodeItem[]): PaletteItem[] {
  const result: PaletteItem[] = []
  const traverse = (items: TreeNodeItem[], path = '') => {
    for (const item of items) {
      if (item.isFolder && item.children) {
        traverse(item.children, `${path}${item.content}/`)
      } else if (!item.isFolder) {
        result.push({
          id: item.href,
          title: item.content,
          href: item.href,
          subPath: path.replace(/\/$/, '')
        })
      }
    }
  }
  traverse(nodes)
  return result
}

const allItems = computed<PaletteItem[]>(() => {
  const fileItems = flattenTree(props.files)
  const headingItems: PaletteItem[] = (props.headings || []).map((h) => ({
    id: h.id,
    title: h.content,
    href: h.href,
    subPath: `文章大纲 H${h.level} 章节`,
    isHeading: true
  }))
  return [...fileItems, ...headingItems]
})

const filteredItems = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return allItems.value.slice(0, 12)
  }
  return allItems.value
    .filter((i) => i.title.toLowerCase().includes(q) || (i.subPath && i.subPath.toLowerCase().includes(q)))
    .slice(0, 16)
})

const totalCount = computed(() => filteredItems.value.length + actions.length)

function moveSelection(delta: number) {
  const max = totalCount.value
  if (max === 0) return
  selectedIndex.value = (selectedIndex.value + delta + max) % max
}

function selectCurrent() {
  const filesLen = filteredItems.value.length
  if (selectedIndex.value < filesLen) {
    handleItemClick(filteredItems.value[selectedIndex.value])
  } else {
    const action = actions[selectedIndex.value - filesLen]
    if (action) handleActionClick(action)
  }
}

function handleItemClick(item: PaletteItem) {
  if (item.isHeading) {
    emit('select-heading', item.href.slice(1))
  } else {
    emit('select-file', item)
  }
  emit('close')
}

function handleActionClick(action: { id: string }) {
  emit('trigger-action', action.id)
  emit('close')
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      query.value = ''
      selectedIndex.value = 0
      nextTick(() => inputRef.value?.focus())
    }
  }
)
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
