<template>
  <aside
    class="mdr-right-side fixed top-54px right-14px bottom-14px z-30 flex flex-col bg-[--bg-card]/92 backdrop-blur-xl text-[--text-primary] rounded-2xl border border-[--border-color] shadow-lg select-none print:hidden overflow-hidden transition-[width,transform] duration-200"
    :style="{ width: `${width}px` }"
  >
    <!-- Card Header (Reading Radar Mini-Dashboard with Quick Filter) -->
    <div class="p-10px px-14px border-b border-[--border-color] flex flex-col gap-6px bg-[--bg-card]/80 backdrop-blur-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-6px">
          <SvgIcon name="outline" class="w-4 h-4 text-[--primary-color]" />
          <span class="text-12px font-bold text-[--text-primary] tracking-tight">文章大纲</span>
          <span v-if="outlineList.length > 0" class="text-10px font-mono text-[--text-muted] px-5px py-1px rounded-full bg-[--bg-subtle] border border-[--border-subtle]">
            {{ outlineList.length }}
          </span>
        </div>

        <div class="flex items-center gap-4px text-10px font-mono text-[--text-muted]">
          <span class="px-5px py-1.5px rounded bg-[--bg-subtle] border border-[--border-subtle]" title="预计阅读时间">⏱️ {{ readingTime }}m</span>
          <span class="px-5px py-1.5px rounded bg-[--bg-subtle] border border-[--border-subtle]" title="文档总字数">📝 {{ wordCount }}字</span>
        </div>
      </div>

      <!-- Outline Filter Input (Appears when outline is long > 8) -->
      <div v-if="outlineList.length > 8" class="relative flex items-center w-full mt-2px">
        <SvgIcon name="search" class="absolute left-8px w-3 h-3 text-[--text-muted] pointer-events-none" />
        <input
          v-model="filterKey"
          type="text"
          placeholder="过滤章节标题..."
          class="w-full h-26px box-border pl-24px pr-22px py-0 text-11px rounded-lg bg-[--bg-subtle] border border-[--border-subtle] text-[--text-primary] placeholder-[--text-muted] transition-all focus:outline-none focus:border-[--primary-color]"
        />
        <button
          v-if="filterKey"
          class="absolute right-4px p-2px rounded-full text-[--text-muted] hover:text-[--text-primary] cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
          title="清空"
          @click="filterKey = ''"
        >
          <SvgIcon name="close" class="w-2.5 h-2.5" />
        </button>
      </div>
    </div>

    <!-- Outline Heading Items with Sleek Scrollbar & Tree Spine -->
    <div
      ref="outlineContainerRef"
      class="outline-scroll-container flex-1 overflow-y-auto p-8px space-y-1px relative"
    >
      <!-- Continuous Guide Spine Line -->
      <div class="absolute left-14px top-12px bottom-12px w-1px bg-[--border-subtle] pointer-events-none"></div>

      <div v-if="filteredOutline.length === 0" class="flex flex-col items-center justify-center p-28px text-center text-12px text-[--text-muted]">
        <SvgIcon name="outline" class="w-7 h-7 mb-6px opacity-25 text-[--text-muted]" />
        <span>{{ filterKey ? '未找到匹配章节' : '当前文档暂无标题' }}</span>
      </div>

      <div
        v-for="item in filteredOutline"
        :key="item.id"
        :data-heading-id="item.href.slice(1)"
        class="outline-item-row relative py-5px px-8px rounded-lg hover:bg-[--bg-hover] text-[--text-secondary] hover:text-[--text-primary] cursor-pointer text-12px truncate transition-colors leading-relaxed group"
        :style="{ paddingLeft: `${(item.level - 1) * 11 + 16}px` }"
        :class="{ 'font-semibold text-[--primary-color] bg-[--primary-light] shadow-xs': activeId === item.href.slice(1) }"
        :title="item.content"
        @click="handleClick(item)"
      >
        <!-- Active Pip on the Guide Line -->
        <span
          v-if="activeId === item.href.slice(1)"
          class="absolute left-5px top-7px bottom-7px w-2px rounded-full bg-[--primary-color]"
        ></span>
        <span class="truncate">{{ item.content }}</span>
      </div>
    </div>

    <!-- Left Drag Splitter -->
    <div
      class="absolute left-0 top-0 bottom-0 w-3px cursor-col-resize hover:bg-[--primary-color] transition-colors"
      title="拖拽调整大纲栏宽度"
      @mousedown="startResize"
    ></div>
  </aside>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue'
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { computeDocStats } from '../core/doc-stats'
import type { OutlineItem } from '@/shared/types'

const props = withDefaults(
  defineProps<{
    outlineList: OutlineItem[]
    rawContent?: string
    width?: number
  }>(),
  {
    outlineList: () => [],
    rawContent: '',
    width: 250
  }
)

const emit = defineEmits<{
  (e: 'update:width', val: number): void
}>()

const activeId = ref('')
const filterKey = ref('')
const outlineContainerRef = ref<HTMLElement | null>(null)

let isClicking = false
let clickResetTimer: number | null = null

// 字数统计与阅读时长计算位于 Rust（doc_stats）；序号守卫防止乱序覆盖
const wordCount = ref(0)
const readingTime = ref(1)
let statsSeq = 0

watch(
  () => props.rawContent,
  async (raw) => {
    const seq = ++statsSeq
    const stats = await computeDocStats(raw || '')
    if (seq !== statsSeq) return
    wordCount.value = stats.words
    readingTime.value = stats.minutes
  },
  { immediate: true }
)

const filteredOutline = computed(() => {
  if (!filterKey.value.trim()) return props.outlineList
  const key = filterKey.value.toLowerCase()
  return props.outlineList.filter((item) => item.content.toLowerCase().includes(key))
})

// Instant jump on outline item click with top header offset
function handleClick(item: OutlineItem) {
  const targetId = item.href.slice(1)
  const el = document.getElementById(targetId)
  if (el) {
    isClicking = true
    if (clickResetTimer) clearTimeout(clickResetTimer)

    const headerOffset = 54
    const elementPosition = el.getBoundingClientRect().top
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset

    // 1. Instant jump on main article (立即跳转，无迟滞等待)
    window.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: 'auto'
    })

    activeId.value = targetId
    scrollActiveOutlineIntoView(targetId)

    clickResetTimer = window.setTimeout(() => {
      isClicking = false
    }, 150)
  }
}

// Auto-scroll the right outline container so active heading remains visible
function scrollActiveOutlineIntoView(id: string) {
  if (!outlineContainerRef.value || !id) return
  const container = outlineContainerRef.value
  const rowEl = container.querySelector(`[data-heading-id="${CSS.escape(id)}"]`) as HTMLElement
  if (!rowEl) return

  const containerRect = container.getBoundingClientRect()
  const rowRect = rowEl.getBoundingClientRect()

  if (rowRect.top < containerRect.top + 20 || rowRect.bottom > containerRect.bottom - 20) {
    rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// Real-time Scroll Spy: track visible heading as user scrolls the main markdown document
let ticking = false

function checkActiveHeadingOnScroll() {
  if (isClicking) return

  const headings = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.mdr-content h1, .mdr-content h2, .mdr-content h3, .mdr-content h4, .mdr-content h5, .mdr-content h6'
    )
  )
  if (headings.length === 0) return

  const headerOffset = 64
  let currentId = ''

  for (let i = 0; i < headings.length; i++) {
    const rect = headings[i].getBoundingClientRect()
    if (rect.top <= headerOffset + 20) {
      currentId = headings[i].id
    } else {
      break
    }
  }

  if (!currentId && headings.length > 0) {
    currentId = headings[0].id
  }

  if (currentId && currentId !== activeId.value) {
    activeId.value = currentId
    scrollActiveOutlineIntoView(currentId)
  }
}

function handleWindowScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      checkActiveHeadingOnScroll()
      ticking = false
    })
    ticking = true
  }
}

function startResize(e: MouseEvent) {
  const startX = e.clientX
  const startWidth = props.width

  const onMouseMove = (moveEvent: MouseEvent) => {
    const newWidth = Math.max(200, Math.min(440, startWidth - (moveEvent.clientX - startX)))
    emit('update:width', newWidth)
    document.documentElement.style.setProperty('--right-side-width', `${newWidth}px`)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

watch(
  () => props.outlineList,
  () => {
    nextTick(() => {
      checkActiveHeadingOnScroll()
    })
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
  window.addEventListener('resize', handleWindowScroll, { passive: true })
  nextTick(() => {
    checkActiveHeadingOnScroll()
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('resize', handleWindowScroll)
  if (clickResetTimer) clearTimeout(clickResetTimer)
})
</script>

<style scoped>
.outline-scroll-container {
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}
.outline-scroll-container::-webkit-scrollbar {
  width: 4px;
}
.outline-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}
.outline-scroll-container::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}
.outline-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
