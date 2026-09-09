<template>
  <header class="mdr-top-header fixed top-0 left-0 right-0 h-44px z-40 flex items-center justify-between px-14px bg-[--bg-page] border-b border-[--border-color] print:hidden select-none transition-colors">
    <!-- Left Section: Sidebar Toggle & Back / Forward Buttons (extension style) -->
    <div class="flex items-center gap-4px min-w-0 flex-shrink-0">
      <!-- Toggle Left Sidebar Button -->
      <IconButton
        v-if="isLocal"
        title="收起侧边栏"
        shortcut="⌘B"
        :active="leftOpen"
        @click="$emit('toggle-left-side')"
      >
        <IconSidebarLeft class="w-4 h-4" />
      </IconButton>

      <!-- History Back Button -->
      <IconButton
        title="后退"
        shortcut="⌘["
        @click="goBack"
      >
        <IconArrowLeft class="w-4 h-4" />
      </IconButton>

      <!-- History Forward Button -->
      <IconButton
        title="前进"
        shortcut="⌘]"
        @click="goForward"
      >
        <IconArrowRight class="w-4 h-4" />
      </IconButton>
    </div>

    <!-- Center Section: Clean -->
    <div class="flex-1"></div>

    <!-- Right Section: Clean Icon Actions (extension style) -->
    <div class="flex items-center gap-4px flex-shrink-0">
      <!-- Search Palette Button -->
      <IconButton
        title="搜索"
        shortcut="⌘K"
        @click="$emit('open-search')"
      >
        <IconSearch class="w-4 h-4" />
      </IconButton>

      <!-- Toggle Edit / Preview Mode (WYSIWYG Online Editor) -->
      <IconButton
        :title="isEditMode ? '完成编辑并返回阅读视图' : '在线编辑文档'"
        shortcut="⌘E"
        :active="isEditMode"
        @click="$emit('toggle-edit')"
      >
        <IconEye v-if="isEditMode" class="w-4 h-4" />
        <IconEdit v-else class="w-4 h-4" />
      </IconButton>

      <!-- Toggle Fullscreen -->
      <IconButton
        :title="isFullscreen ? '退出全屏' : '全屏沉浸阅读'"
        shortcut="⌘F"
        @click="toggleFullscreen"
      >
        <IconMinimize v-if="isFullscreen" class="w-4 h-4" />
        <IconMaximize v-else class="w-4 h-4" />
      </IconButton>

      <!-- Print Document -->
      <IconButton
        title="打印 / 导出 PDF"
        shortcut="⌘P"
        @click="printDocument"
      >
        <IconPrinter class="w-4 h-4" />
      </IconButton>

      <!-- Theme Switcher -->
      <IconButton
        :title="themeTitle"
        shortcut="⌘T"
        @click="$emit('toggle-theme')"
      >
        <IconSun v-if="theme === 'light'" class="w-4 h-4 text-amber-500" />
        <IconMoon v-else-if="theme === 'dark'" class="w-4 h-4 text-indigo-400" />
        <IconDeviceAuto v-else class="w-4 h-4" />
      </IconButton>

      <!-- Preferences Settings (Classic Gear) -->
      <IconButton
        title="偏好设置"
        shortcut="⌘,"
        @click="$emit('open-settings')"
      >
        <IconSettings class="w-4 h-4" />
      </IconButton>

      <div class="w-1px h-14px bg-[--border-color] mx-2px"></div>

      <!-- Toggle Right Outline Sidebar Button -->
      <IconButton
        title="切换大纲"
        shortcut="⌘U"
        :active="rightOpen"
        @click="$emit('toggle-right-side')"
      >
        <IconSlidersHorizontal class="w-4 h-4" />
      </IconButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import IconButton from '@/components/IconButton.vue'
import IconSidebarLeft from '@/components/icons/IconSidebarLeft.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconSearch from '@/components/icons/IconSearch.vue'
import IconEdit from '@/components/icons/IconEdit.vue'
import IconEye from '@/components/icons/IconEye.vue'
import IconMaximize from '@/components/icons/IconMaximize.vue'
import IconMinimize from '@/components/icons/IconMinimize.vue'
import IconPrinter from '@/components/icons/IconPrinter.vue'
import IconSun from '@/components/icons/IconSun.vue'
import IconMoon from '@/components/icons/IconMoon.vue'
import IconDeviceAuto from '@/components/icons/IconDeviceAuto.vue'
import IconSettings from '@/components/icons/IconSettings.vue'
import IconSlidersHorizontal from '@/components/icons/IconSlidersHorizontal.vue'

const props = defineProps<{
  theme: 'auto' | 'light' | 'dark'
  leftOpen: boolean
  rightOpen: boolean
  isLocal: boolean
  isEditMode?: boolean
}>()

defineEmits<{
  (e: 'toggle-left-side'): void
  (e: 'toggle-right-side'): void
  (e: 'toggle-theme'): void
  (e: 'open-settings'): void
  (e: 'open-search'): void
  (e: 'toggle-edit'): void
}>()

const isFullscreen = ref(false)

const themeTitle = computed(() => {
  if (props.theme === 'dark') return '切换为浅色主题'
  if (props.theme === 'light') return '切换为跟随系统'
  return '切换为深色主题'
})

function goBack() {
  window.history.back()
}

function goForward() {
  window.history.forward()
}

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
