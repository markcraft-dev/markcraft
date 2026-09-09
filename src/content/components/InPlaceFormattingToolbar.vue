<template>
  <div
    v-show="visible"
    ref="toolbarRef"
    class="mdr-in-place-toolbar fixed z-50 flex items-center gap-2px p-4px rounded-xl bg-[#18181b] text-white shadow-2xl border border-white/10 select-none animate-in transition-all"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
      transform: 'translate(-50%, -100%)'
    }"
    @mousedown.prevent
  >
    <button class="fmt-btn font-bold" title="加粗 (Cmd+B)" @click="exec('bold')">
      B
    </button>
    <button class="fmt-btn italic" title="斜体 (Cmd+I)" @click="exec('italic')">
      I
    </button>
    <button class="fmt-btn line-through text-11px" title="删除线" @click="exec('strikeThrough')">
      S
    </button>

    <div class="w-1px h-12px bg-white/20 mx-2px"></div>

    <button class="fmt-btn text-11px font-mono font-bold" title="大标题" @click="formatBlock('h2')">
      H2
    </button>
    <button class="fmt-btn text-11px font-mono font-bold" title="小标题" @click="formatBlock('h3')">
      H3
    </button>
    <button class="fmt-btn text-11px font-mono" title="正文段落" @click="formatBlock('p')">
      P
    </button>

    <div class="w-1px h-12px bg-white/20 mx-2px"></div>

    <button class="fmt-btn text-11px font-mono" title="引用段落" @click="formatBlock('blockquote')">
      “ ”
    </button>
    <button class="fmt-btn text-11px font-mono" title="行内代码" @click="wrapInlineCode">
      &lt;/&gt;
    </button>
    <button class="fmt-btn text-11px font-mono" title="无序列表" @click="exec('insertUnorderedList')">
      • List
    </button>
    <button class="fmt-btn text-11px font-mono" title="插入链接" @click="insertLink">
      🔗
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
