<template>
  <div
    class="mdr-action-bar fixed top-16px z-40 flex items-center gap-4px bg-[--bg-card] border border-[--border-color] shadow-md rounded-full p-4px px-8px backdrop-blur-md print:hidden transition-[right,colors] duration-200 select-none"
    :style="{ right: rightOpen ? `${rightWidth + 20}px` : '20px' }"
  >
    <!-- Toggle Left File Sidebar -->
    <button
      class="action-btn p-6px rounded-full text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
      :class="{ 'text-[--primary-color] bg-[--primary-light] font-semibold': leftOpen }"
      :title="leftOpen ? '收起左侧文件列表 (Cmd+B)' : '展开左侧文件列表 (Cmd+B)'"
      @click="$emit('toggle-left-side')"
    >
      <IconSidebarLeft class="w-4 h-4" />
    </button>

    <!-- Toggle Right Outline Sidebar -->
    <button
      class="action-btn p-6px rounded-full text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
      :class="{ 'text-[--primary-color] bg-[--primary-light] font-semibold': rightOpen }"
      :title="rightOpen ? '收起右侧文章大纲' : '展开右侧文章大纲'"
      @click="$emit('toggle-right-side')"
    >
      <IconSidebarRight class="w-4 h-4" />
    </button>

    <div class="w-1px h-14px bg-[--border-color] mx-2px"></div>

    <!-- Toggle Raw Markdown Source -->
    <button
      class="action-btn p-6px rounded-full text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
      :class="{ 'text-[--primary-color] bg-[--primary-light] font-semibold': isRawMode }"
      :title="isRawMode ? '返回富文本渲染视图' : '查看 Markdown 原始源码'"
      @click="$emit('toggle-raw')"
    >
      <IconFileCode class="w-4 h-4" />
    </button>

    <!-- Toggle Fullscreen -->
    <button
      class="action-btn p-6px rounded-full text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
      :title="isFullscreen ? '退出全屏' : '全屏沉浸阅读'"
      @click="toggleFullscreen"
    >
      <IconMinimize v-if="isFullscreen" class="w-4 h-4" />
      <IconMaximize v-else class="w-4 h-4" />
    </button>

    <!-- Print Document -->
    <button
      class="action-btn p-6px rounded-full text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
      title="打印 / 导出 PDF (Cmd+P)"
      @click="printDocument"
    >
      <IconPrinter class="w-4 h-4" />
    </button>

    <div class="w-1px h-14px bg-[--border-color] mx-2px"></div>

    <!-- Theme Toggle -->
    <button
      class="action-btn p-6px rounded-full text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
      :title="themeTitle"
      @click="$emit('toggle-theme')"
    >
      <IconSun v-if="theme === 'light'" class="w-4 h-4 text-amber-500" />
      <IconMoon v-else-if="theme === 'dark'" class="w-4 h-4 text-indigo-400" />
      <IconDeviceAuto v-else class="w-4 h-4" />
    </button>

    <!-- Open Settings -->
    <button
      class="action-btn p-6px rounded-full text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
      title="偏好设置"
      @click="$emit('open-settings')"
    >
      <IconSettings class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import IconSidebarLeft from '@/components/icons/IconSidebarLeft.vue'
import IconSidebarRight from '@/components/icons/IconSidebarRight.vue'
import IconFileCode from '@/components/icons/IconFileCode.vue'
import IconMaximize from '@/components/icons/IconMaximize.vue'
import IconMinimize from '@/components/icons/IconMinimize.vue'
import IconPrinter from '@/components/icons/IconPrinter.vue'
import IconSun from '@/components/icons/IconSun.vue'
import IconMoon from '@/components/icons/IconMoon.vue'
import IconDeviceAuto from '@/components/icons/IconDeviceAuto.vue'
import IconSettings from '@/components/icons/IconSettings.vue'

const props = withDefaults(
  defineProps<{
    theme: 'auto' | 'light' | 'dark'
    leftOpen: boolean
    rightOpen: boolean
    rightWidth?: number
    isRawMode?: boolean
  }>(),
  {
    rightWidth: 260
  }
)

defineEmits<{
  (e: 'toggle-left-side'): void
  (e: 'toggle-right-side'): void
  (e: 'toggle-theme'): void
  (e: 'open-settings'): void
  (e: 'toggle-raw'): void
}>()

const isFullscreen = ref(false)

const themeTitle = computed(() => {
  if (props.theme === 'dark') return '当前暗黑主题（点击切换）'
  if (props.theme === 'light') return '当前明亮主题（点击切换）'
  return '当前跟随系统（点击切换）'
})

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.warn('Failed to enter fullscreen:', err)
    })
  } else {
    document.exitFullscreen().catch((err) => {
      console.warn('Failed to exit fullscreen:', err)
    })
  }
}

function printDocument() {
  window.print()
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>
