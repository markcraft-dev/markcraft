<template>
  <header class="mdr-top-header fixed top-0 left-0 right-0 h-44px z-40 flex items-center justify-between px-12px bg-[--bg-page]/85 backdrop-blur-xl border-b border-[--border-color] print:hidden select-none transition-colors">
    <!-- Left Section: Sidebar Toggle & History Navigation Island -->
    <div class="flex items-center gap-2px p-2px rounded-lg bg-[--bg-subtle]/50 border border-[--border-subtle] min-w-0 flex-shrink-0">
      <!-- Toggle Left Sidebar Button -->
      <IconButton
        v-if="isLocal"
        title="收起侧边栏"
        shortcut="⌘B"
        :active="leftOpen"
        @click="$emit('toggle-left-side')"
      >
        <SvgIcon name="sidebar-left" class="w-4 h-4" />
      </IconButton>

      <!-- History Back Button -->
      <IconButton
        title="后退"
        shortcut="⌘["
        @click="goBack"
      >
        <SvgIcon name="arrow-left" class="w-4 h-4" />
      </IconButton>

      <!-- History Forward Button -->
      <IconButton
        title="前进"
        shortcut="⌘]"
        @click="goForward"
      >
        <SvgIcon name="arrow-right" class="w-4 h-4" />
      </IconButton>
    </div>

    <!-- Center Section: Interactive Breadcrumb Capsule (Fills the Void) -->
    <div class="flex-1 flex items-center justify-center px-12px min-w-0">
      <button
        class="breadcrumb-capsule flex items-center gap-6px py-4px px-12px rounded-full bg-[--bg-subtle]/70 hover:bg-[--bg-hover] border border-[--border-color] text-12px transition-colors cursor-pointer max-w-[min(500px,50vw)] group"
        title="点击快速搜索与跳转文件 (⌘K)"
        @click="$emit('open-search')"
      >
        <SvgIcon name="folder" class="w-3.5 h-3.5 text-[--text-muted] flex-shrink-0" />
        <span v-if="folderName" class="text-[--text-muted] font-medium truncate max-w-120px">{{ folderName }}</span>
        <span v-if="folderName" class="text-[--text-muted] opacity-35 font-mono">/</span>
        <SvgIcon name="file-markdown" class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span class="text-[--text-primary] font-semibold truncate">{{ docTitle || 'MarkCraft' }}</span>
        <!-- R9: reading progress % next to the title (rail keeps the bar) -->
        <span
          class="text-[--text-muted] font-mono text-11px flex-shrink-0 opacity-80"
          :title="`已阅读 ${Math.round(readProgress || 0)}%`"
        >{{ Math.round(readProgress || 0) }}%</span>
        <span
          v-if="isEditMode"
          class="ml-4px px-6px py-1px rounded-full text-10px font-mono flex items-center gap-4px"
          :class="isDirty ? 'bg-amber-500/15 text-amber-500 font-medium' : 'bg-emerald-500/15 text-emerald-500 font-medium'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="isDirty ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'"></span>
          {{ isDirty ? '编辑中*' : '已保存' }}
        </span>
      </button>
    </div>

    <!-- Right Section: Edit Actions Island (only in edit mode, lives in the header so it never covers content) + Tools Island -->
    <div class="flex items-center gap-2px flex-shrink-0">
      <!-- Edit Actions: save / finish / discard (replaces the old floating banner) -->
      <div
        v-if="isEditMode"
        class="flex items-center gap-2px p-2px rounded-lg bg-[--bg-subtle]/50 border border-[--border-subtle] mr-2px"
      >
        <!-- Save -->
        <button
          class="edit-action-btn"
          :class="isDirty
            ? 'bg-[--primary-color] text-white hover:bg-[--primary-hover] shadow-xs font-semibold'
            : 'text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] font-medium'"
          :title="isDirty ? '保存至原文件 (Cmd+S)' : '无未保存修改 (Cmd+S)'"
          @click="$emit('save')"
        >
          <SvgIcon name="save" class="w-3.5 h-3.5" />
          <span>保存</span>
          <kbd class="edit-kbd" :class="isDirty ? 'edit-kbd-on-primary' : ''">⌘S</kbd>
        </button>

        <!-- Finish editing -->
        <button
          class="edit-action-btn text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] font-medium"
          title="完成编辑并返回阅读视图 (Cmd+E)"
          @click="$emit('finish-edit')"
        >
          <SvgIcon name="check" class="w-3.5 h-3.5" />
          <span>完成</span>
          <kbd class="edit-kbd">⌘E</kbd>
        </button>

        <!-- Discard changes -->
        <button
          class="edit-action-btn w-26px px-0 text-[--text-muted] hover:text-red-500 hover:bg-red-500/10"
          title="放弃未保存的修改并重新载入"
          @click="$emit('discard-edit')"
        >
          <SvgIcon name="rotate-ccw" class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Tools Island -->
      <div class="flex items-center gap-2px p-2px rounded-lg bg-[--bg-subtle]/50 border border-[--border-subtle] flex-shrink-0">
      <!-- Search Palette Button -->
      <IconButton
        title="搜索"
        shortcut="⌘K"
        @click="$emit('open-search')"
      >
        <SvgIcon name="search" class="w-4 h-4" />
      </IconButton>

      <!-- Toggle Edit / Preview Mode -->
      <IconButton
        :title="isEditMode ? '完成编辑并返回阅读视图' : '在线编辑文档'"
        shortcut="⌘E"
        :active="isEditMode"
        @click="$emit('toggle-edit')"
      >
        <SvgIcon name="eye" v-if="isEditMode" class="w-4 h-4" />
        <SvgIcon name="edit" v-else class="w-4 h-4" />
      </IconButton>

      <!-- Toggle Fullscreen -->
      <IconButton
        :title="isFullscreen ? '退出全屏' : '全屏沉浸阅读'"
        shortcut="⌘F"
        @click="toggleFullscreen"
      >
        <SvgIcon name="minimize" v-if="isFullscreen" class="w-4 h-4" />
        <SvgIcon name="maximize" v-else class="w-4 h-4" />
      </IconButton>

      <!-- Print Document -->
      <IconButton
        title="打印 / 导出 PDF"
        shortcut="⌘P"
        @click="printDocument"
      >
        <SvgIcon name="printer" class="w-4 h-4" />
      </IconButton>

      <!-- Theme Switcher -->
      <IconButton
        :title="themeTitle"
        shortcut="⌘T"
        @click="$emit('toggle-theme')"
      >
        <SvgIcon name="sun" v-if="theme === 'light'" class="w-4 h-4 text-amber-500" />
        <SvgIcon name="sun" v-else-if="theme === 'sepia'" class="w-4 h-4 text-amber-600" />
        <SvgIcon name="moon" v-else-if="theme === 'dark'" class="w-4 h-4 text-indigo-400" />
        <SvgIcon name="sun" v-else-if="theme === 'verdant'" class="w-4 h-4 text-emerald-500" />
        <SvgIcon name="moon" v-else-if="theme === 'nordic'" class="w-4 h-4 text-sky-400" />
        <SvgIcon name="moon" v-else-if="theme === 'dracula'" class="w-4 h-4 text-purple-400" />
        <SvgIcon name="device-auto" v-else class="w-4 h-4" />
      </IconButton>

      <!-- Preferences Settings -->
      <IconButton
        title="偏好设置"
        shortcut="⌘,"
        @click="$emit('open-settings')"
      >
        <SvgIcon name="settings" class="w-4 h-4" />
      </IconButton>

      <div class="w-1px h-14px bg-[--border-color] mx-2px"></div>

      <!-- Toggle Right Outline Sidebar Button -->
      <IconButton
        title="切换大纲"
        shortcut="⌘U"
        :active="rightOpen"
        @click="$emit('toggle-right-side')"
      >
        <SvgIcon name="sliders-horizontal" class="w-4 h-4" />
      </IconButton>
      </div>
    </div>

    <!-- 2px Ambient Reading Progress Rail -->
    <div class="absolute bottom-0 left-0 right-0 h-2px pointer-events-none overflow-hidden bg-[--border-subtle]">
      <div
        class="h-full transition-[width] duration-150 ease-out bg-gradient-to-r from-[--primary-color] via-indigo-500 to-purple-500"
        :style="{ width: `${readProgress || 0}%` }"
      ></div>
    </div>
  </header>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import IconButton from '@/components/IconButton.vue'

const props = defineProps<{
  theme: 'auto' | 'light' | 'sepia' | 'verdant' | 'dark' | 'nordic' | 'dracula'
  leftOpen: boolean
  rightOpen: boolean
  isLocal: boolean
  isEditMode?: boolean
  isDirty?: boolean
  docTitle?: string
  folderName?: string
  readProgress?: number
}>()

defineEmits<{
  (e: 'toggle-left-side'): void
  (e: 'toggle-right-side'): void
  (e: 'toggle-theme'): void
  (e: 'open-settings'): void
  (e: 'open-search'): void
  (e: 'toggle-edit'): void
  (e: 'save'): void
  (e: 'finish-edit'): void
  (e: 'discard-edit'): void
}>()

const isFullscreen = ref(false)

const themeTitle = computed(() => {
  if (props.theme === 'light') return '当前: 明亮模式 (点击切换羊皮纸)'
  if (props.theme === 'sepia') return '当前: 羊皮纸模式 (点击切换豆沙护眼)'
  if (props.theme === 'dark') return '当前: 暗黑极夜 (点击切换北欧冷雾)'
  if (props.theme === 'verdant') return '当前: 豆沙护眼 (点击切换深空极夜)'
  if (props.theme === 'nordic') return '当前: 北欧冷雾 (点击切换妖紫魅夜)'
  if (props.theme === 'dracula') return '当前: 妖紫魅夜 (点击切换跟随系统)'
  return '当前: 跟随系统 (点击切换明亮)'
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

<style scoped>
.edit-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  border: 0;
  outline: none;
  background: transparent;
  transition: all 0.12s ease;
  white-space: nowrap;
}
.edit-kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.16);
  color: inherit;
  opacity: 0.8;
}
.edit-kbd-on-primary {
  background: rgba(255, 255, 255, 0.24);
  color: #ffffff;
  opacity: 1;
}
</style>
