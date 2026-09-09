<template>
  <transition name="modal-fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-16px bg-black/25 backdrop-blur-[2px] select-none"
      @click.self="$emit('close')"
    >
      <!-- Centered Modal Card (Comfortable View & Zero Long Travel) -->
      <div
        class="bg-[--bg-page] text-[--text-primary] max-w-460px w-full max-h-[85vh] rounded-2xl shadow-2xl border border-[--border-color] flex flex-col overflow-hidden animate-in"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-20px py-16px border-b border-[--border-color] bg-[--bg-subtle]">
          <div class="flex items-center gap-10px">
            <div class="p-6px rounded-lg bg-[--primary-light] text-[--primary-color]">
              <SvgIcon name="settings" class="w-4.5 h-4.5"  />
            </div>
            <h2 class="text-15px font-bold text-[--text-primary]">MarkCraft 偏好设置</h2>
          </div>
          <button
            class="p-6px rounded-lg text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
            title="关闭设置 (Esc)"
            @click="$emit('close')"
          >
            <SvgIcon name="close" class="w-4 h-4"  />
          </button>
        </div>

        <!-- Body Form -->
        <div class="flex-1 overflow-y-auto p-20px flex flex-col gap-20px text-13px">
          <!-- Appearance Theme -->
          <div>
            <label class="block font-semibold text-[--text-secondary] mb-8px">界面主题</label>
            <div class="grid grid-cols-3 gap-6px bg-[--bg-subtle] p-3px rounded-xl border border-[--border-subtle]">
              <button
                v-for="mode in (['auto', 'light', 'dark'] as const)"
                :key="mode"
                class="flex items-center justify-center gap-6px py-6px rounded-lg transition-all text-center cursor-pointer border-0 outline-none"
                :class="settings.pageTheme === mode ? 'bg-[--bg-page] text-[--primary-color] font-semibold shadow-sm' : 'bg-transparent text-[--text-secondary] hover:text-[--text-primary]'"
                @click="setTheme(mode)"
              >
                <SvgIcon name="device-auto" v-if="mode === 'auto'" class="w-3.5 h-3.5"  />
                <SvgIcon name="sun" v-else-if="mode === 'light'" class="w-3.5 h-3.5 text-amber-500"  />
                <SvgIcon name="moon" v-else class="w-3.5 h-3.5 text-indigo-400"  />
                <span>{{ mode === 'auto' ? '跟随系统' : mode === 'light' ? '明亮' : '暗黑' }}</span>
              </button>
            </div>
          </div>

          <!-- Typography: Font & Size -->
          <div class="grid grid-cols-2 gap-12px">
            <div>
              <label class="block font-semibold text-[--text-secondary] mb-6px">排版字体</label>
              <select
                v-model="settings.textFont"
                class="w-full py-6px px-8px rounded-lg border border-[--border-color] bg-[--bg-subtle] text-[--text-primary] focus:outline-none focus:border-[--primary-color] cursor-pointer text-12px"
                @change="handleFontChange"
              >
                <option value="Default">系统默认</option>
                <option value="Inter">Inter (现代无衬线)</option>
                <option value="Roboto">Roboto</option>
                <option value="Merriweather">Merriweather (优雅衬线)</option>
                <option value="NotoSerifSC">思源宋体</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-[--text-secondary] mb-6px">字号大小</label>
              <select
                v-model="settings.textSize"
                class="w-full py-6px px-8px rounded-lg border border-[--border-color] bg-[--bg-subtle] text-[--text-primary] focus:outline-none focus:border-[--primary-color] cursor-pointer text-12px"
                @change="handleSizeChange"
              >
                <option value="Small">小号 (14px)</option>
                <option value="Normal">标准 (16px)</option>
                <option value="Medium">中等 (18px)</option>
                <option value="Large">大号 (20px)</option>
                <option value="Extra Large">特大 (24px)</option>
              </select>
            </div>
          </div>

          <!-- Content Width Slider -->
          <div>
            <div class="flex items-center justify-between mb-6px">
              <label class="font-semibold text-[--text-secondary]">最大阅读宽度</label>
              <span class="text-12px font-mono text-[--primary-color] font-medium">{{ contentWidthValue }}px</span>
            </div>
            <input
              type="range"
              min="650"
              max="1400"
              step="50"
              v-model.number="contentWidthValue"
              class="w-full accent-blue-500 cursor-pointer"
              @input="handleWidthInput"
            />
          </div>

          <!-- Markdown Plugins -->
          <div>
            <label class="block font-semibold text-[--text-secondary] mb-8px">渲染特性开关</label>
            <div class="grid grid-cols-2 gap-8px">
              <label
                v-for="p in ['Katex', 'Mermaid', 'Alert', 'TaskLists', 'MultimdTable', 'Emoji']"
                :key="p"
                class="flex items-center gap-6px p-8px rounded-lg border border-[--border-subtle] bg-[--bg-subtle] hover:bg-[--bg-hover] cursor-pointer transition-colors text-12px"
              >
                <input
                  type="checkbox"
                  :checked="isPluginActive(p)"
                  class="accent-blue-500 cursor-pointer w-3.5 h-3.5 rounded"
                  @change="togglePlugin(p)"
                />
                <span class="font-medium text-[--text-primary]">{{ pluginLabel(p) }}</span>
              </label>
            </div>
          </div>

          <!-- Custom CSS -->
          <div>
            <div class="flex items-center justify-between mb-6px">
              <label class="font-semibold text-[--text-secondary]">自定义 CSS 样式</label>
              <label class="flex items-center gap-4px text-12px text-[--text-muted] cursor-pointer">
                <input v-model="settings.enableCustomCSS" type="checkbox" class="accent-blue-500 cursor-pointer" @change="saveChanges" />
                <span>启用</span>
              </label>
            </div>
            <textarea
              v-model="settings.customCSS"
              rows="3"
              placeholder="/* 输入 CSS 规则，如：.mdr-content h1 { color: #3b82f6; } */"
              class="w-full p-8px font-mono text-11px rounded-lg border border-[--border-color] bg-[--bg-subtle] text-[--text-primary] focus:outline-none focus:border-[--primary-color]"
              @input="saveChanges"
            ></textarea>
          </div>

          <!-- About & Feedback Section -->
          <div class="pt-16px border-t border-[--border-color] flex flex-col gap-10px">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-6px">
                <SvgIcon name="info" class="w-4 h-4 text-[--text-muted]"  />
                <span class="font-semibold text-[--text-secondary]">关于与反馈</span>
              </div>
              <span class="text-11px font-mono px-6px py-2px rounded bg-[--bg-subtle] text-[--text-secondary] font-semibold border border-[--border-subtle]">v1.0.0</span>
            </div>

            <div class="grid grid-cols-2 gap-8px text-12px">
              <a
                href="https://github.com/markcraft-dev/markcraft"
                target="_blank"
                class="flex items-center justify-center gap-6px p-8px rounded-lg border border-[--border-subtle] bg-[--bg-subtle] hover:bg-[--bg-hover] text-[--text-primary] transition-colors no-underline"
              >
                <span>GitHub 仓库</span>
                <SvgIcon name="external-link" class="w-3.5 h-3.5 text-[--text-muted]"  />
              </a>
              <a
                href="https://github.com/markcraft-dev/markcraft/issues"
                target="_blank"
                class="flex items-center justify-center gap-6px p-8px rounded-lg border border-[--border-subtle] bg-[--bg-subtle] hover:bg-[--bg-hover] text-[--primary-color] font-medium transition-colors no-underline"
              >
                <span>提交问题 / 反馈</span>
                <SvgIcon name="external-link" class="w-3.5 h-3.5"  />
              </a>
            </div>
          </div>
        </div>

        <!-- Footer with Reset & Finish -->
        <div class="flex items-center justify-between px-20px py-14px border-t border-[--border-color] bg-[--bg-subtle]">
          <button
            class="text-12px text-[--text-muted] hover:text-[--text-primary] flex items-center gap-4px cursor-pointer border-0 outline-none bg-transparent transition-colors"
            title="恢复所有设置到默认值"
            @click="resetToDefault"
          >
            <SvgIcon name="rotate-ccw" class="w-3.5 h-3.5"  />
            <span>恢复默认</span>
          </button>

          <div class="flex items-center gap-10px">
            <button
              class="text-12px text-[--primary-color] hover:underline cursor-pointer border-0 outline-none bg-transparent flex items-center gap-3px"
              @click="openFullOptions"
            >
              <span>完整选项页</span>
              <SvgIcon name="external-link" class="w-3.5 h-3.5"  />
            </button>
            <button
              class="px-16px py-6px rounded-lg bg-[--primary-color] hover:bg-[--primary-hover] text-white font-medium text-12px transition-colors cursor-pointer border-0 outline-none shadow-sm"
              @click="finishSettings"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { useStorage } from '@/shared/storage'
import { DEFAULT_SETTINGS } from '@/shared/constants'
import { applyTheme, applyCustomStyles } from '../core/theme'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'theme-changed', theme: 'auto' | 'light' | 'dark'): void }>()

const { settings, loadSettings, saveSettings } = useStorage()
const contentWidthValue = ref(900)

function isPluginActive(p: string): boolean {
  return Array.isArray(settings.value?.mdPlugins) && settings.value.mdPlugins.includes(p)
}

function pluginLabel(p: string): string {
  const map: Record<string, string> = {
    Katex: 'KaTeX 数学公式',
    Mermaid: 'Mermaid 图表',
    Alert: 'Alert 警告提示框',
    TaskLists: '任务复选框',
    MultimdTable: '高级多行表格',
    Emoji: 'Emoji 表情解析'
  }
  return map[p] || p
}

function setTheme(theme: 'auto' | 'light' | 'dark') {
  settings.value.pageTheme = theme
  saveSettings({ pageTheme: theme })
  applyTheme(theme)
  emit('theme-changed', theme)
}

function handleFontChange() {
  saveChanges()
}

function handleSizeChange() {
  saveChanges()
}

function handleWidthInput() {
  settings.value.enableCustomContentWidth = true
  settings.value.customContentWidth = contentWidthValue.value
  document.documentElement.style.setProperty('--content-max-width', `${contentWidthValue.value}px`)
  saveSettings({
    enableCustomContentWidth: true,
    customContentWidth: contentWidthValue.value
  })
}

function togglePlugin(name: string) {
  const list = Array.isArray(settings.value?.mdPlugins) ? [...settings.value.mdPlugins] : []
  const idx = list.indexOf(name)
  if (idx > -1) {
    list.splice(idx, 1)
  } else {
    list.push(name)
  }
  settings.value.mdPlugins = list
  saveSettings({ mdPlugins: list })
}

function saveChanges() {
  saveSettings(settings.value)
  applyCustomStyles(
    settings.value.enableCustomCSS ? settings.value.customCSS : undefined,
    settings.value.enableCustomContentWidth ? settings.value.customContentWidth : undefined,
    settings.value.textFont,
    settings.value.textSize
  )
}

function resetToDefault() {
  settings.value = { ...DEFAULT_SETTINGS }
  saveSettings(DEFAULT_SETTINGS)
  contentWidthValue.value = DEFAULT_SETTINGS.customContentWidth || 900
  applyTheme(DEFAULT_SETTINGS.pageTheme)
  applyCustomStyles(
    undefined,
    DEFAULT_SETTINGS.customContentWidth,
    DEFAULT_SETTINGS.textFont,
    DEFAULT_SETTINGS.textSize
  )
  emit('theme-changed', DEFAULT_SETTINGS.pageTheme)
}

function finishSettings() {
  saveChanges()
  emit('close')
}

function openFullOptions() {
  chrome.runtime.sendMessage({ action: 'open-options-page' })
}

function handleKeyDown(e: KeyboardEvent) {
  if (props.visible && e.key === 'Escape') {
    emit('close')
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
  await loadSettings()
  if (settings.value.customContentWidth) {
    contentWidthValue.value = settings.value.customContentWidth
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
