<template>
  <div
    v-show="visible"
    ref="toolbarRef"
    class="mdr-in-place-toolbar fixed z-50 flex items-center gap-2px p-4px rounded-2xl bg-[#18181b]/92 backdrop-blur-xl text-white shadow-2xl border border-white/12 ring-1 ring-black/40 select-none animate-in transition-all"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
      transform: 'translate(-50%, -100%)'
    }"
    @mousedown.prevent
  >
    <button class="fmt-btn" title="加粗 (Cmd+B)" @click="exec('bold')">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
    </button>
    <button class="fmt-btn" title="斜体 (Cmd+I)" @click="exec('italic')">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
    </button>
    <button class="fmt-btn" title="删除线" @click="exec('strikeThrough')">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"></path><path d="M14 12a4 4 0 0 1 0 8H6"></path><line x1="4" y1="12" x2="20" y2="12"></line></svg>
    </button>

    <div class="w-1px h-12px bg-white/20 mx-2px"></div>

    <button class="fmt-btn text-11px font-mono font-bold" title="大标题 (H2)" @click="formatBlock('h2')">
      H2
    </button>
    <button class="fmt-btn text-11px font-mono font-bold" title="小标题 (H3)" @click="formatBlock('h3')">
      H3
    </button>
    <button class="fmt-btn text-11px font-mono" title="正文段落 (P)" @click="formatBlock('p')">
      P
    </button>

    <div class="w-1px h-12px bg-white/20 mx-2px"></div>

    <button class="fmt-btn" title="引用段落" @click="formatBlock('blockquote')">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path></svg>
    </button>
    <button class="fmt-btn" title="行内代码" @click="wrapInlineCode">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
    </button>
    <button class="fmt-btn" title="无序列表" @click="exec('insertUnorderedList')">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
    </button>
    <button class="fmt-btn" title="插入超链接" @click="insertLink">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  active: boolean
  container: HTMLElement | null
}>()

const visible = ref(false)
const position = ref({ x: 0, y: 0 })
const toolbarRef = ref<HTMLElement | null>(null)

function updateToolbarPosition() {
  if (!props.active || !props.container) {
    visible.value = false
    return
  }

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    visible.value = false
    return
  }

  const range = selection.getRangeAt(0)
  if (!props.container.contains(range.commonAncestorContainer)) {
    visible.value = false
    return
  }

  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    visible.value = false
    return
  }

  position.value = {
    x: Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2)),
    y: Math.max(50, rect.top - 8)
  }
  visible.value = true
}

function exec(command: string, value: string = '') {
  document.execCommand(command, false, value)
  updateToolbarPosition()
}

function formatBlock(tag: string) {
  document.execCommand('formatBlock', false, `<${tag}>`)
  updateToolbarPosition()
}

function wrapInlineCode() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  const codeEl = document.createElement('code')
  codeEl.appendChild(range.extractContents())
  range.insertNode(codeEl)
  selection.removeAllRanges()
  visible.value = false
}

function insertLink() {
  const url = prompt('请输入链接地址 (URL):', 'https://')
  if (url) {
    exec('createLink', url)
  }
}

function handleSelectionChange() {
  setTimeout(updateToolbarPosition, 10)
}

onMounted(() => {
  document.addEventListener('selectionchange', handleSelectionChange)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', handleSelectionChange)
})
</script>

<style scoped>
.fmt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 7px;
  border-radius: 6px;
  color: #e4e4e7;
  cursor: pointer;
  border: 0;
  outline: none;
  background: transparent;
  transition: all 0.12s ease;
}
.fmt-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}
</style>
