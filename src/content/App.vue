<template>
  <div class="mdr-app flex flex-col min-h-screen bg-[--bg-page] text-[--text-primary] transition-colors duration-150 relative">
    <!-- extension-style Top Navigation Header Bar (Unified Full-Width Bar) -->
    <TopHeader
      :theme="currentTheme"
      :left-open="leftSideOpen"
      :right-open="rightSideOpen"
      :is-local="isLocal"
      :is-edit-mode="isEditMode"
      :is-dirty="isDirty"
      :doc-title="currentDocTitle"
      :folder-name="currentDocFolder"
      :read-progress="readingProgress"
      @toggle-left-side="leftSideOpen = !leftSideOpen"
      @toggle-right-side="rightSideOpen = !rightSideOpen"
      @toggle-theme="toggleTheme"
      @open-settings="settingsVisible = true"
      @open-search="searchVisible = true"
      @toggle-edit="toggleEditMode"
    />

    <!-- In-Place Edit Floating Top Banner -->
    <transition name="toast-fade">
      <InPlaceEditBanner
        v-if="isEditMode"
        :is-dirty="isDirty"
        @save="saveInPlace"
        @finish="finishInPlaceEdit"
        @cancel="cancelInPlaceEdit"
      />
    </transition>

    <!-- Floating Text Selection Formatting Toolbar (extension/Notion Style) -->
    <InPlaceFormattingToolbar
      :active="isEditMode"
      :container="contentRef"
    />

    <!-- Main Workspace Layout with Left Sidebar, Central Content & Right Outline Card -->
    <div class="flex-1 flex pt-44px relative min-h-screen">
      <!-- Left Sidebar: Dedicated File Explorer -->
      <Side
        v-if="leftSideOpen && isLocal"
        ref="sideRef"
        :is-local="isLocal"
        :width="leftSideWidth"
        @update:width="(w) => leftSideWidth = w"
        @change-raw="handleContentChange"
        @open-settings="settingsVisible = true"
        @open-search="searchVisible = true"
        @tree-loaded="(nodes) => folderTreeNodes = nodes"
      />

      <!-- Main Content Reading & In-Place Editing Canvas -->
      <main
        class="mdr-main flex-1 transition-[margin] duration-200 min-w-0"
        :style="{
          marginLeft: leftSideOpen && isLocal ? `${leftSideWidth}px` : '0',
          marginRight: rightSideOpen ? `${rightSideWidth + 28}px` : '0'
        }"
      >
        <div class="mdr-container mx-auto px-28px sm:px-44px py-36px max-w-[var(--content-max-width,900px)]">
          <!-- Rendered Markdown HTML Reading & In-Place WYSIWYG Article -->
          <article
            ref="contentRef"
            class="mdr-content transition-all"
            :class="{ 'mdr-in-place-editing': isEditMode }"
            :contenteditable="isEditMode"
            spellcheck="false"
            v-html="renderedHtml"
            @input="handleInPlaceInput"
          ></article>
        </div>
      </main>

      <!-- Right Sidebar: Dedicated Article Outline & Metadata (extension floating Card) -->
      <RightSidebar
        v-if="rightSideOpen"
        :outline-list="outlineData.list"
        :raw-content="rawMarkdownContent"
        :width="rightSideWidth"
        @update:width="(w) => rightSideWidth = w"
      />
    </div>

    <!-- Bottom Right Floating Back to Top with Scroll Progress -->
    <BackToTop />

    <!-- Centered Search Command Palette (Screenshot 3 - Cmd+K) -->
    <SearchPaletteModal
      :visible="searchVisible"
      :files="folderTreeNodes"
      :headings="outlineData.list"
      @close="searchVisible = false"
      @select-file="handlePaletteSelectFile"
      @select-heading="handlePaletteSelectHeading"
      @trigger-action="handlePaletteAction"
    />

    <!-- Centered Settings Dialog (Zero Long Mouse Travel & Click-Outside to Dismiss) -->
    <SettingsModal
      :visible="settingsVisible"
      @close="settingsVisible = false"
      @theme-changed="(t) => currentTheme = t"
    />

    <!-- Image Lightbox Modal & Downloader -->
    <ImageLightbox
      :visible="lightboxVisible"
      :src="lightboxSrc"
      :alt="lightboxAlt"
      @close="lightboxVisible = false"
    />

    <!-- Floating Global Toast Notification -->
    <transition name="toast-fade">
      <div
        v-if="toastMessage"
        class="fixed bottom-24px left-1/2 -translate-x-1/2 z-50 px-16px py-9px rounded-xl bg-[#18181b] text-white text-12px font-medium shadow-2xl border border-white/10 flex items-center gap-6px pointer-events-none"
      >
        <span>{{ toastMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import TopHeader from './components/TopHeader.vue'
import Side from './components/Side.vue'
import RightSidebar from './components/RightSidebar.vue'
import InPlaceEditBanner from './components/InPlaceEditBanner.vue'
import InPlaceFormattingToolbar from './components/InPlaceFormattingToolbar.vue'
import BackToTop from './components/BackToTop.vue'
import SettingsModal from './components/SettingsModal.vue'
import SearchPaletteModal, { type PaletteItem } from './components/SearchPaletteModal.vue'
import ImageLightbox from './components/ImageLightbox.vue'
import { renderMarkdown, renderMermaidDiagrams } from './core/markdown'
import { extractOutline } from './core/outline'
import { applyTheme, applyCustomStyles } from './core/theme'
import { enhanceContentBlocks } from './core/enhancements'
import { copyAsRichText, exportAsStandaloneHtml } from './core/export'
import { domToMarkdown } from './core/dom-to-markdown'
import { storeFileHandle, storeDirectoryHandle, trySilentSave, trySilentSaveViaDirectory, writeToFileHandle } from './core/file-handle-storage'
import { useStorage } from '@/shared/storage'
import type { OutlineItem, TreeNodeItem } from '@/shared/types'

const props = defineProps<{
  initialContent: string
}>()

const isLocal = ref(window.location.protocol === 'file:')
const leftSideOpen = ref(true)
const rightSideOpen = ref(window.innerWidth > 1200)
const leftSideWidth = ref(260)
const rightSideWidth = ref(250)

const currentTheme = ref<'auto' | 'light' | 'dark' | 'sepia' | 'nordic'>('auto')
const readingProgress = ref(0)
const settingsVisible = ref(false)
const searchVisible = ref(false)
const isEditMode = ref(false)
const isDirty = ref(false)
const rawMarkdownContent = ref(props.initialContent)
const renderedHtml = ref('')
const currentActiveHref = ref(window.location.href)

const currentDocTitle = computed(() => {
  try {
    const url = currentActiveHref.value
    const clean = url.split('?')[0].split('#')[0]
    const file = clean.split('/').pop() || ''
    return decodeURIComponent(file) || 'Markdown'
  } catch {
    return 'Markdown'
  }
})

const currentDocFolder = computed(() => {
  try {
    const url = currentActiveHref.value
    const clean = url.split('?')[0].split('#')[0]
    const parts = clean.split('/')
    if (parts.length >= 2) {
      return decodeURIComponent(parts[parts.length - 2])
    }
  } catch {}
  return ''
})

function updateReadingProgress() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  readingProgress.value = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0
}
const contentRef = ref<HTMLElement | null>(null)
const sideRef = ref<InstanceType<typeof Side> | null>(null)
const outlineData = ref<{ tree: OutlineItem[]; list: OutlineItem[] }>({ tree: [], list: [] })
const folderTreeNodes = ref<TreeNodeItem[]>([])
const toastMessage = ref('')

// Lightbox state
const lightboxVisible = ref(false)
const lightboxSrc = ref('')
const lightboxAlt = ref('')

function openLightbox(src: string, alt: string) {
  if (isEditMode.value) return // Don't open lightbox during editing
  lightboxSrc.value = src
  lightboxAlt.value = alt
  lightboxVisible.value = true
}

const { settings, loadSettings } = useStorage()

async function updateMarkdown(rawText: string) {
  rawMarkdownContent.value = rawText
  renderedHtml.value = renderMarkdown(rawText)
  await nextTick()

  if (contentRef.value) {
    outlineData.value = await extractOutline(contentRef.value, settings.value.maxOutlineExpandLevel)
    enhanceContentBlocks(contentRef.value, openLightbox)
  }

  await renderMermaidDiagrams()
}

function handleContentChange(newContent: string, newHref?: string) {
  if (newHref) {
    currentActiveHref.value = newHref
  }
  updateMarkdown(newContent)
}

function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 2800)
}

function toggleEditMode() {
  if (isEditMode.value) {
    finishInPlaceEdit()
  } else {
    isEditMode.value = true
    showToast('✏️ 已开启原地所见即所得编辑模式，可直接在页面上修改')
  }
}

async function handleInPlaceInput() {
  isDirty.value = true
  if (contentRef.value) {
    outlineData.value = await extractOutline(contentRef.value, settings.value.maxOutlineExpandLevel)
  }
}

async function saveInPlace(): Promise<boolean> {
  if (!contentRef.value) return false
  const newMarkdown = await domToMarkdown(contentRef.value)
  const fileUrl = currentActiveHref.value
  const fileName = decodeURIComponent(fileUrl.split('/').pop() || 'document.md')

  // 1. 静默保存：已授权的文件句柄优先，其次已授权目录句柄（覆盖原文件，绝不新建）
  try {
    const silentSuccess = (await trySilentSave(fileUrl, newMarkdown)) || (await trySilentSaveViaDirectory(fileUrl, newMarkdown))
    if (silentSuccess) {
      rawMarkdownContent.value = newMarkdown
      isDirty.value = false
      showToast('✓ 已直接静默覆盖保存至原文件')
      return true
    }
  } catch (e) {
    console.warn('Silent save check error:', e)
  }

  // 2. 首次授权：让用户选择文档所在文件夹（readwrite）。
  //    目录句柄持久化后，该文件夹内所有文件均静默覆盖保存，不再弹任何对话框。
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'markcraft-workspace' })
      const dirUrl = fileUrl.substring(0, fileUrl.lastIndexOf('/') + 1) || fileUrl
      // create:false：选中的文件夹里必须已存在同名文件，防止误存到错误位置
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: false })
      const ok = await writeToFileHandle(fileHandle, newMarkdown)
      if (ok) {
        await storeDirectoryHandle(dirUrl, dirHandle)
        await storeFileHandle(fileUrl, fileHandle)
        await storeFileHandle(fileName, fileHandle)
        rawMarkdownContent.value = newMarkdown
        isDirty.value = false
        showToast('✓ 已覆盖保存原文件；此文件夹后续将静默保存')
        return true
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        showToast('✕ 已取消保存')
        return false
      }
      // 选错文件夹（不含当前文档）等情况 → 回退到单文件对话框
      console.warn('Directory authorization fallback:', err)
    }
  }

  // 3. 兜底：单文件另存对话框（文件名已预填）
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'Markdown Document',
          accept: { 'text/markdown': ['.md', '.markdown'] }
        }]
      })
      if (handle) {
        await storeFileHandle(fileUrl, handle)
        await storeFileHandle(fileName, handle)

        const ok = await writeToFileHandle(handle, newMarkdown)
        if (ok) {
          rawMarkdownContent.value = newMarkdown
          isDirty.value = false
          showToast('✓ 文件已授权并保存，后续将直接静默保存')
          return true
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      showToast('✕ 已取消保存')
      return false
    }
    console.warn('File save error:', err)
    showToast('✕ 保存失败: ' + (err.message || '未知错误'))
    return false
  }

  return false
}

async function finishInPlaceEdit() {
  if (isDirty.value && contentRef.value) {
    const saved = await saveInPlace()
    if (!saved) {
      // User cancelled save dialog
      return
    }
  }

  if (contentRef.value) {
    const newMarkdown = await domToMarkdown(contentRef.value)
    rawMarkdownContent.value = newMarkdown
    updateMarkdown(newMarkdown)
  }
  isEditMode.value = false
  isDirty.value = false
  showToast('✓ 已退出编辑模式')
}

function cancelInPlaceEdit() {
  updateMarkdown(rawMarkdownContent.value)
  isEditMode.value = false
  isDirty.value = false
  showToast('✕ 已放弃未保存的修改')
}

function toggleTheme() {
  const sequence: Array<'auto' | 'light' | 'sepia' | 'dark' | 'nordic'> = [
    'auto',
    'light',
    'sepia',
    'dark',
    'nordic'
  ]
  const curIdx = sequence.indexOf(currentTheme.value)
  const next = sequence[(curIdx + 1) % sequence.length]
  currentTheme.value = next
  applyTheme(next)
  settings.value.pageTheme = next
  useStorage().saveSettings({ pageTheme: next })
}

function handlePaletteSelectFile(item: PaletteItem) {
  if (item.href) {
    chrome.runtime.sendMessage({ type: 'bg-fetch', url: item.href }, (res) => {
      if (res && res.ok && res.res !== undefined) {
        handleContentChange(res.res, item.href)
        try {
          history.pushState({ href: item.href }, '', item.href)
        } catch {
          document.title = item.title
        }
      } else {
        window.location.href = item.href
      }
    })
  }
}

function handlePaletteSelectHeading(headingId: string) {
  const el = document.getElementById(headingId)
  if (el) {
    const headerOffset = 54
    const elementPosition = el.getBoundingClientRect().top
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset
    window.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: 'auto'
    })
  }
}

async function handlePaletteAction(actionId: string) {
  if (actionId === 'settings') {
    settingsVisible.value = true
  } else if (actionId === 'theme') {
    toggleTheme()
  } else if (actionId === 'edit') {
    toggleEditMode()
  } else if (actionId === 'fullscreen') {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  } else if (actionId === 'print') {
    window.print()
  } else if (actionId === 'copy-rich') {
    if (contentRef.value) {
      const ok = await copyAsRichText(contentRef.value)
      if (ok) showToast('✓ 已复制富文本排版，可直接粘贴至公众号 / 知乎')
      else showToast('✕ 复制失败，请稍后重试')
    }
  } else if (actionId === 'export-html') {
    const docTitle = document.title || 'MarkCraft-Export'
    exportAsStandaloneHtml(docTitle, renderedHtml.value)
    showToast('✓ 已成功导出单文件 HTML')
  } else if (actionId === 'export-md') {
    const docTitle = document.title || 'document'
    const md = contentRef.value && isEditMode.value ? await domToMarkdown(contentRef.value) : rawMarkdownContent.value
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docTitle.replace(/[/\\?%*:|"<>]/g, '_')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('✓ 已成功下载 Markdown 文件')
  }
}

// Global Shortcuts: Cmd+K, Cmd+B, Cmd+U, Cmd+E, Cmd+S, Cmd+, Alt+C, Alt+H
function handleGlobalKeydown(e: KeyboardEvent) {
  const isMeta = e.metaKey || e.ctrlKey
  if (isMeta && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchVisible.value = !searchVisible.value
  } else if (isMeta && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    leftSideOpen.value = !leftSideOpen.value
  } else if (isMeta && e.key.toLowerCase() === 'u') {
    e.preventDefault()
    rightSideOpen.value = !rightSideOpen.value
  } else if (isMeta && e.key.toLowerCase() === 'e') {
    e.preventDefault()
    toggleEditMode()
  } else if (isMeta && e.key.toLowerCase() === 's') {
    if (isEditMode.value) {
      e.preventDefault()
      saveInPlace()
    }
  } else if (isMeta && e.key === ',') {
    e.preventDefault()
    settingsVisible.value = !settingsVisible.value
  } else if (e.altKey && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    handlePaletteAction('copy-rich')
  } else if (e.altKey && e.key.toLowerCase() === 'h') {
    e.preventDefault()
    handlePaletteAction('export-html')
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('scroll', updateReadingProgress, { passive: true })
  updateReadingProgress()
  await loadSettings()
  currentTheme.value = settings.value.pageTheme || 'auto'
  applyTheme(currentTheme.value)
  applyCustomStyles(
    settings.value.enableCustomCSS ? settings.value.customCSS : undefined,
    settings.value.enableCustomContentWidth ? settings.value.customContentWidth : undefined,
    settings.value.textFont,
    settings.value.textSize
  )

  await updateMarkdown(props.initialContent)

  if (window.innerWidth < 1100) {
    rightSideOpen.value = false
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'command') {
      if (msg.command === 'toggleSide') leftSideOpen.value = !leftSideOpen.value
      if (msg.command === 'togglePageTheme') toggleTheme()
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('scroll', updateReadingProgress)
})
</script>

<style scoped>
/* In-Place WYSIWYG Editing Styles */
.mdr-in-place-editing {
  outline: none;
  cursor: text;
}

.mdr-in-place-editing :deep(p),
.mdr-in-place-editing :deep(h1),
.mdr-in-place-editing :deep(h2),
.mdr-in-place-editing :deep(h3),
.mdr-in-place-editing :deep(h4),
.mdr-in-place-editing :deep(h5),
.mdr-in-place-editing :deep(h6),
.mdr-in-place-editing :deep(blockquote),
.mdr-in-place-editing :deep(pre),
.mdr-in-place-editing :deep(table),
.mdr-in-place-editing :deep(ul),
.mdr-in-place-editing :deep(ol) {
  position: relative;
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
  border-radius: 4px;
}

.mdr-in-place-editing :deep(p:hover),
.mdr-in-place-editing :deep(h1:hover),
.mdr-in-place-editing :deep(h2:hover),
.mdr-in-place-editing :deep(h3:hover),
.mdr-in-place-editing :deep(blockquote:hover),
.mdr-in-place-editing :deep(pre:hover),
.mdr-in-place-editing :deep(table:hover) {
  box-shadow: 0 0 0 1px var(--border-color);
}

.mdr-in-place-editing :deep(p:focus),
.mdr-in-place-editing :deep(h1:focus),
.mdr-in-place-editing :deep(h2:focus),
.mdr-in-place-editing :deep(h3:focus),
.mdr-in-place-editing :deep(blockquote:focus),
.mdr-in-place-editing :deep(pre:focus),
.mdr-in-place-editing :deep(table:focus) {
  box-shadow: 0 0 0 1.5px var(--primary-color) !important;
  background-color: var(--bg-hover);
  outline: none;
}
</style>
