<template>
  <transition name="modal-fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-start justify-center pt-12vh p-16px sm:p-24px bg-black/45 backdrop-blur-[6px] select-none"
      @click.self="$emit('close')"
    >
      <!-- Wide-Screen Responsive Command Palette Card -->
      <div
        role="dialog"
        aria-modal="true"
        aria-label="快速搜索与指令"
        class="search-palette w-full max-w-[min(90vw,760px)] bg-[--bg-page]/95 backdrop-blur-2xl text-[--text-primary] rounded-2xl shadow-2xl border border-[--border-color] flex flex-col overflow-hidden animate-in"
      >
        <!-- Top Prominent Search Input Row -->
        <div class="flex items-center px-18px py-14px border-b border-[--border-color] bg-[--bg-page]/90 gap-12px">
          <div class="p-6px rounded-lg bg-[--primary-light] text-[--primary-color] flex-shrink-0">
            <SvgIcon name="search" class="w-4.5 h-4.5" />
          </div>
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
              找到 {{ activeListLength }} 项
            </span>
            <kbd class="mdr-kbd text-10px font-mono">ESC</kbd>
          </div>
        </div>

        <!-- Tab Switcher: 文件/章节 vs 全文检索 -->
        <div class="flex items-center gap-6px px-12px pt-8px" role="tablist" aria-label="搜索模式">
          <button
            role="tab"
            :aria-selected="activeTab === 'files'"
            class="px-10px py-4px rounded-lg text-12px font-medium transition-colors cursor-pointer border-0 outline-none"
            :class="activeTab === 'files'
              ? 'bg-[--primary-light] text-[--primary-color]'
              : 'text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover]'"
            @click="switchTab('files')"
          >
            文件 / 章节
          </button>
          <button
            role="tab"
            :aria-selected="activeTab === 'content'"
            class="px-10px py-4px rounded-lg text-12px font-medium transition-colors cursor-pointer border-0 outline-none flex items-center gap-5px"
            :class="activeTab === 'content'
              ? 'bg-[--primary-light] text-[--primary-color]'
              : 'text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover]'"
            @click="switchTab('content')"
          >
            全文
            <span
              v-if="activeTab === 'content' && fulltextHits.length > 0"
              class="text-10px font-mono px-4px rounded-full bg-[--primary-color]/15"
            >{{ fulltextHits.length }}</span>
          </button>
          <span v-if="activeTab === 'content' && ftStatusText" class="ml-auto text-10px font-mono text-[--text-muted]">
            {{ ftStatusText }}
          </span>
        </div>

        <!-- Scrollable Search Results List -->
        <div class="max-h-[min(58vh,520px)] overflow-y-auto p-10px flex flex-col gap-3px">
          <!-- Files & Outline Section -->
          <div v-if="activeTab === 'files' && filteredItems.length > 0">
            <div class="px-12px py-6px text-11px font-semibold text-[--text-muted] uppercase tracking-wider flex items-center justify-between">
              <span>{{ query ? '匹配结果' : '最近与推荐文件' }}</span>
              <span class="text-10px font-normal opacity-70">支持 ↑ ↓ 导航，Enter 确认</span>
            </div>

            <div
              v-for="(item, idx) in filteredItems"
              :key="item.id || item.href"
              class="flex items-center justify-between px-12px py-9px rounded-xl cursor-pointer transition-all select-none group"
              :class="selectedIndex === idx
                ? 'bg-[--bg-hover] text-[--text-primary] font-medium shadow-xs ring-1 ring-[--primary-color]/40'
                : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'"
              @mouseenter="selectedIndex = idx"
              @click="handleItemClick(item)"
            >
              <!-- File Name & Path Info -->
              <div class="flex items-center gap-10px min-w-0 flex-1 mr-14px">
                <span class="p-5px rounded-lg bg-[--bg-subtle] border border-[--border-subtle] flex-shrink-0">
                  <SvgIcon name="file-markdown" v-if="!item.isHeading" class="w-4 h-4 text-blue-500" />
                  <SvgIcon name="outline" v-else class="w-4 h-4 text-[--primary-color]" />
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
                  class="text-11px font-mono text-[--primary-color] px-8px py-3px rounded-md bg-[--primary-light] font-semibold flex items-center gap-4px border border-[--primary-color]/25 shadow-xs"
                >
                  ↵ 打开
                </span>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="activeTab === 'files' && query" class="flex flex-col items-center justify-center p-36px text-center text-13px text-[--text-muted]">
            <SvgIcon name="search" class="w-8 h-8 mb-8px opacity-20 text-[--text-muted]" />
            <span>未找到与 “{{ query }}” 相关的 Markdown 文件或章节</span>
          </div>

          <!-- Full-text Section (R7: WASM 倒排索引，标题加权) -->
          <div v-else-if="activeTab === 'content'">
            <div class="px-12px py-6px text-11px font-semibold text-[--text-muted] uppercase tracking-wider flex items-center justify-between">
              <span>全文匹配</span>
              <span class="text-10px font-normal opacity-70">支持 ↑ ↓ 导航，Enter 确认</span>
            </div>

            <div v-if="ftStatus.state === 'unsupported'" class="flex flex-col items-center justify-center p-36px text-center text-13px text-[--text-muted]">
              <SvgIcon name="search" class="w-8 h-8 mb-8px opacity-20 text-[--text-muted]" />
              <span>全文检索仅支持本地文件夹（file://）</span>
            </div>

            <div v-else-if="ftStatus.state === 'indexing'" class="flex flex-col items-center justify-center p-36px text-center text-13px text-[--text-muted]">
              <SvgIcon name="search" class="w-8 h-8 mb-8px opacity-20 text-[--text-muted] animate-pulse" />
              <span>正在建立全文索引 {{ ftStatus.indexed }}/{{ ftStatus.total }}…</span>
            </div>

            <div v-else-if="!query" class="flex flex-col items-center justify-center p-36px text-center text-13px text-[--text-muted]">
              <SvgIcon name="search" class="w-8 h-8 mb-8px opacity-20 text-[--text-muted]" />
              <span>输入关键词搜索全部文档正文（标题加权优先）</span>
            </div>

            <template v-else-if="fulltextHits.length > 0">
              <div
                v-for="(item, cIdx) in fulltextHits"
                :key="item.id || item.href"
                class="flex items-center justify-between px-12px py-9px rounded-xl cursor-pointer transition-all select-none group"
                :class="selectedIndex === cIdx
                  ? 'bg-[--bg-hover] text-[--text-primary] font-medium shadow-xs ring-1 ring-[--primary-color]/40'
                  : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'"
                @mouseenter="selectedIndex = cIdx"
                @click="handleItemClick(item)"
              >
                <!-- File Name + Snippet -->
                <div class="flex items-center gap-10px min-w-0 flex-1 mr-14px">
                  <span class="p-5px rounded-lg bg-[--bg-subtle] border border-[--border-subtle] flex-shrink-0">
                    <SvgIcon name="file-markdown" class="w-4 h-4 text-blue-500" />
                  </span>

                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-8px">
                      <span class="text-13px font-semibold text-[--text-primary] truncate tracking-tight">{{ item.title }}</span>
                    </div>
                    <span v-if="item.subPath" class="text-11px text-[--text-muted] truncate font-mono mt-1px">
                      {{ item.subPath }}
                    </span>
                    <!-- 摘要 HTML 安全构造：转义文本 + <mark>（search-index.renderSnippetHtml） -->
                    <div v-if="item.snippetHtml" class="mdr-ft-snippet" v-html="item.snippetHtml"></div>
                  </div>
                </div>

                <!-- Action Indicator Pill -->
                <div class="flex items-center gap-6px flex-shrink-0">
                  <span
                    v-if="selectedIndex === cIdx"
                    class="text-11px font-mono text-[--primary-color] px-8px py-3px rounded-md bg-[--primary-light] font-semibold flex items-center gap-4px border border-[--primary-color]/25 shadow-xs"
                  >
                    ↵ 打开
                  </span>
                </div>
              </div>
            </template>

            <div v-else class="flex flex-col items-center justify-center p-36px text-center text-13px text-[--text-muted]">
              <SvgIcon name="search" class="w-8 h-8 mb-8px opacity-20 text-[--text-muted]" />
              <span>正文中未找到 “{{ query }}”</span>
            </div>
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
              :class="selectedIndex === activeListLength + aIdx
                ? 'bg-[--bg-hover] text-[--text-primary] font-medium shadow-xs ring-1 ring-[--primary-color]/40'
                : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'"
              @mouseenter="selectedIndex = activeListLength + aIdx"
              @click="handleActionClick(action)"
            >
              <div class="flex items-center gap-10px">
                <span class="p-5px rounded-lg bg-[--bg-subtle] border border-[--border-subtle] flex-shrink-0 text-[--text-muted] group-hover:text-[--text-primary] transition-colors">
                  <SvgIcon :name="action.icon" class="w-4 h-4" />
                </span>
                <span class="font-medium">{{ action.title }}</span>
              </div>
              <kbd class="mdr-kbd text-10px font-mono">
                {{ action.shortcut }}
              </kbd>
            </div>
          </div>
        </div>

        <!-- Footer Bar with Keyboard Hints -->
        <div class="px-16px py-9px border-t border-[--border-color] bg-[--bg-subtle]/80 flex items-center justify-between text-11px text-[--text-muted]">
          <div class="flex items-center gap-14px">
            <span class="flex items-center gap-4px"><kbd class="mdr-kbd text-10px font-mono">↑</kbd><kbd class="mdr-kbd text-10px font-mono">↓</kbd> 导航</span>
            <span class="flex items-center gap-4px"><kbd class="mdr-kbd text-10px font-mono">↵</kbd> 确认</span>
            <span class="flex items-center gap-4px"><kbd class="mdr-kbd text-10px font-mono">ESC</kbd> 退出</span>
          </div>
          <span class="font-mono text-10px opacity-60">MarkCraft Quick Open</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue'
import { ref, computed, watch, nextTick } from 'vue'
import { searchPalette, type PaletteItem } from '../core/palette'
import {
  ensureFulltextIndex,
  searchFulltext,
  renderSnippetHtml,
  getFulltextStatus,
  FULLTEXT_LIMIT,
  type FulltextStatus
} from '../core/search-index'
import type { TreeNodeItem, OutlineItem } from '@/shared/types'

export type { PaletteItem }

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
// R7 全文 tab：'files' 为既有文件名/章节搜索，'content' 为 WASM 全文检索
const activeTab = ref<'files' | 'content'>('files')
const fulltextHits = ref<PaletteItem[]>([])
const ftStatus = ref<FulltextStatus>(getFulltextStatus())
const ftElapsed = ref(0)
const ftViaWasm = ref(true)
let ftDebounce: number | null = null

const ftStatusText = computed(() => {
  if (activeTab.value !== 'content') return ''
  if (ftStatus.value.state === 'indexing') return `索引 ${ftStatus.value.indexed}/${ftStatus.value.total}`
  if (ftStatus.value.state === 'ready' && query.value.trim()) {
    return `${fulltextHits.value.length} 项 · ${ftElapsed.value.toFixed(0)} ms${ftViaWasm.value ? '' : ' · JS'}`
  }
  return ''
})

const actions = [
  { id: 'copy-rich', title: '一键复制富文本 (微信/知乎排版)', shortcut: '⌥C', icon: 'copy' },
  { id: 'export-html', title: '导出为单文件 HTML (离线排版)', shortcut: '⌥H', icon: 'download' },
  { id: 'export-md', title: '下载 Markdown 文本文件', shortcut: '⌥S', icon: 'download' },
  { id: 'settings', title: '打开偏好设置', shortcut: '⌘,', icon: 'settings' },
  { id: 'theme', title: '切换界面明暗主题', shortcut: '⌘T', icon: 'sun' },
  { id: 'raw', title: '切换所见即所得编辑 (⌘E)', shortcut: '⌘E', icon: 'file-code' },
  { id: 'fullscreen', title: '全屏沉浸阅读', shortcut: '⌘F', icon: 'maximize' },
  { id: 'print', title: '打印 / 导出 PDF', shortcut: '⌘P', icon: 'printer' }
]

// 条目汇总与过滤位于 Rust（search_palette），此处仅异步取回结果
const filteredItems = ref<PaletteItem[]>([])
let searchSeq = 0

async function runContentSearch(): Promise<void> {
  const q = query.value
  if (!q.trim()) {
    fulltextHits.value = []
    return
  }
  const status = await ensureFulltextIndex(props.files)
  ftStatus.value = status
  if (status.state !== 'ready') {
    fulltextHits.value = []
    return
  }
  const { hits, elapsedMs, viaWasm } = await searchFulltext(q, FULLTEXT_LIMIT)
  // 异步往返期间查询/tab 可能已变：过期结果直接丢弃
  if (q !== query.value || activeTab.value !== 'content') return
  ftElapsed.value = elapsedMs
  ftViaWasm.value = viaWasm
  fulltextHits.value = hits.map((h) => ({
    id: h.href,
    title: h.title,
    href: h.href,
    subPath: '全文匹配',
    snippetHtml: renderSnippetHtml(h.snippet, h.highlights)
  }))
}

function switchTab(tab: 'files' | 'content'): void {
  if (activeTab.value === tab) return
  activeTab.value = tab
  selectedIndex.value = 0
}

watch(
  [() => props.visible, () => props.files, () => props.headings, query, activeTab],
  async () => {
    if (activeTab.value === 'content') {
      // 全文检索防抖 150ms：索引查询本身为内存操作，防抖主要省 bg-fetch 建索引期的重复触发
      if (ftDebounce !== null) window.clearTimeout(ftDebounce)
      ftDebounce = window.setTimeout(() => {
        void runContentSearch()
      }, 150)
      return
    }
    const seq = ++searchSeq
    const items = await searchPalette(props.files, props.headings, query.value)
    if (seq === searchSeq) {
      filteredItems.value = items
      // 结果刷新时夹紧而非归零：输入过程中键盘选择不再跳回首项
      selectedIndex.value = Math.min(selectedIndex.value, items.length + actions.length - 1)
      if (selectedIndex.value < 0) selectedIndex.value = 0
    }
  },
  { immediate: true }
)

// 当前 tab 的结果条数：键盘导航与计数共用
const activeListLength = computed(() =>
  activeTab.value === 'content' ? fulltextHits.value.length : filteredItems.value.length
)
const totalCount = computed(() => activeListLength.value + actions.length)

function moveSelection(delta: number) {
  const max = totalCount.value
  if (max === 0) return
  selectedIndex.value = (selectedIndex.value + delta + max) % max
}

function selectCurrent() {
  if (activeTab.value === 'content') {
    const list = fulltextHits.value
    if (selectedIndex.value < list.length) {
      handleItemClick(list[selectedIndex.value])
    } else {
      const action = actions[selectedIndex.value - list.length]
      if (action) handleActionClick(action)
    }
    return
  }
  const list = filteredItems.value
  if (selectedIndex.value < list.length) {
    handleItemClick(list[selectedIndex.value])
  } else {
    const action = actions[selectedIndex.value - list.length]
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
      activeTab.value = 'files'
      fulltextHits.value = []
      ftElapsed.value = 0
      ftStatus.value = getFulltextStatus()
      nextTick(() => inputRef.value?.focus())
      // 预热全文索引：打开面板即后台建索引，切到全文 tab 时多半已就绪
      void ensureFulltextIndex(props.files).then((s) => {
        ftStatus.value = s
      })
    } else if (ftDebounce !== null) {
      window.clearTimeout(ftDebounce)
      ftDebounce = null
    }
  }
)
</script>

<style scoped>
.mdr-ft-snippet {
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 2px;
  white-space: normal;
}
.mdr-ft-snippet :deep(.mdr-ft-mark) {
  background: var(--primary-light);
  color: var(--primary-color);
  border-radius: 3px;
  padding: 0 1px;
  font-weight: 600;
}
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
