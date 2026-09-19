<template>
  <transition name="modal-fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-16px bg-black/25 backdrop-blur-[2px] select-none"
      @click.self="$emit('close')"
    >
      <!-- Centered Modal Card (Wide Desktop Layout) -->
      <div
        role="dialog"
        aria-modal="true"
        aria-label="MarkCraft 偏好设置"
        class="bg-[--bg-page]/95 backdrop-blur-2xl text-[--text-primary] max-w-680px w-full max-h-[88vh] rounded-2xl shadow-2xl border border-[--border-color] ring-1 ring-black/10 flex flex-col overflow-hidden animate-in"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-22px py-15px border-b border-[--border-color] bg-[--bg-subtle]">
          <div class="flex items-center gap-10px">
            <div class="p-6px rounded-lg bg-[--primary-light] text-[--primary-color]">
              <SvgIcon name="settings" class="w-4.5 h-4.5" />
            </div>
            <h2 class="text-15px font-bold text-[--text-primary]">MarkCraft 偏好设置</h2>
          </div>
          <button
            class="p-6px rounded-lg text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent flex items-center justify-center"
            title="关闭设置 (Esc)"
            @click="$emit('close')"
          >
            <SvgIcon name="close" class="w-4 h-4" />
          </button>
        </div>

        <!-- Body Form -->
        <div class="flex-1 overflow-y-auto p-22px flex flex-col gap-18px text-13px">
          <!-- Appearance Theme Swatches (5 in a single row) -->
          <div>
            <div class="flex items-center justify-between mb-8px">
              <label class="font-semibold text-[--text-secondary] text-12px">大师级意境调色盘</label>
              <span class="text-11px text-[--text-muted]">5 款精调阅读情境</span>
            </div>
            <div class="grid grid-cols-5 gap-8px">
              <button
                v-for="t in themeOptions"
                :key="t.id"
                class="theme-swatch-card flex flex-col items-start p-7px rounded-xl border transition-all cursor-pointer text-left relative group border-0 outline-none select-none"
                :class="settings.pageTheme === t.id
                  ? 'border-1 border-[--primary-color] ring-2 ring-[--primary-color]/25 bg-[--bg-hover]'
                  : 'border-1 border-[--border-color] bg-[--bg-subtle] hover:border-[--text-muted]'"
                @click="setTheme(t.id)"
              >
                <!-- Mini Document Card Preview -->
                <div
                  class="w-full h-32px rounded-lg p-5px flex flex-col justify-between border mb-6px shadow-2xs overflow-hidden"
                  :style="{ background: t.previewBg, borderColor: t.previewBorder }"
                >
                  <div class="flex items-center gap-3px">
                    <div class="w-10px h-3px rounded" :style="{ backgroundColor: t.previewPrimary }"></div>
                    <div class="w-16px h-2px rounded" :style="{ backgroundColor: t.previewText, opacity: 0.4 }"></div>
                  </div>
                  <div class="space-y-1.5px">
                    <div class="w-full h-2px rounded" :style="{ backgroundColor: t.previewText, opacity: 0.6 }"></div>
                    <div class="w-2/3 h-2px rounded" :style="{ backgroundColor: t.previewText, opacity: 0.3 }"></div>
                  </div>
                </div>

                <!-- Theme Name & Description -->
                <div class="flex items-center justify-between w-full">
                  <div class="flex items-center gap-3px min-w-0">
                    <SvgIcon :name="t.icon" class="w-3 h-3 flex-shrink-0" :class="t.iconColor" />
                    <span class="text-11px font-bold text-[--text-primary] truncate">{{ t.label }}</span>
                  </div>
                  <span v-if="settings.pageTheme === t.id" class="w-1.5 h-1.5 rounded-full bg-[--primary-color] flex-shrink-0 ml-2px"></span>
                </div>
              </button>
            </div>
          </div>

          <!-- Typography & Content Width (Balanced 3-column row) -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-12px">
            <div>
              <label class="block font-semibold text-[--text-secondary] mb-6px text-12px">排版字体</label>
              <CustomSelect
                v-model="settings.textFont"
                :options="fontOptions"
                @change="handleFontChange"
              />
            </div>

            <div>
              <label class="block font-semibold text-[--text-secondary] mb-6px text-12px">字号大小</label>
              <CustomSelect
                v-model="settings.textSize"
                :options="sizeOptions"
                @change="handleSizeChange"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-6px">
                <label class="font-semibold text-[--text-secondary] text-12px">最大阅读宽度</label>
                <span class="text-11px font-mono text-[--primary-color] font-medium">{{ contentWidthValue }}px</span>
              </div>
              <input
                type="range"
                min="650"
                max="1400"
                step="50"
                v-model.number="contentWidthValue"
                class="w-full accent-blue-500 cursor-pointer mt-4px"
                @input="handleWidthInput"
              />
            </div>
          </div>

          <!-- Markdown Plugins (3-column grid, 2 rows of 3) -->
          <div>
            <label class="block font-semibold text-[--text-secondary] mb-8px text-12px">渲染特性开关</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-8px">
              <label
                v-for="p in ['Katex', 'Mermaid', 'Alert', 'TaskLists', 'MultimdTable', 'Emoji']"
                :key="p"
                class="flex items-center gap-6px p-7px rounded-lg border border-[--border-subtle] bg-[--bg-subtle] hover:bg-[--bg-hover] cursor-pointer transition-colors text-12px select-none"
              >
                <input
                  type="checkbox"
                  :checked="isPluginActive(p)"
                  class="accent-blue-500 cursor-pointer w-3.5 h-3.5 rounded"
                  @change="togglePlugin(p)"
                />
                <span class="font-medium text-[--text-primary] truncate">{{ pluginLabel(p) }}</span>
              </label>
            </div>
          </div>

          <!-- Custom CSS -->
          <div>
            <div class="flex items-center justify-between mb-6px">
              <label class="font-semibold text-[--text-secondary] text-12px">自定义 CSS 样式</label>
              <label class="flex items-center gap-4px text-12px text-[--text-muted] cursor-pointer select-none">
                <input v-model="settings.enableCustomCSS" type="checkbox" class="accent-blue-500 cursor-pointer" @change="saveChanges" />
                <span>启用样式覆盖</span>
              </label>
            </div>
            <textarea
              v-model="settings.customCSS"
              rows="2"
              placeholder="/* 输入自定义 CSS 规则，如：.mdr-content h1 { color: #3b82f6; } */"
              class="w-full p-8px font-mono text-11px rounded-lg border border-[--border-color] bg-[--bg-subtle] text-[--text-primary] focus:outline-none focus:border-[--primary-color]"
              @input="saveChanges"
            ></textarea>
          </div>

          <!-- About & Feedback Section -->
          <div class="pt-12px border-t border-[--border-color] flex flex-col gap-8px">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-6px">
                <SvgIcon name="info" class="w-3.5 h-3.5 text-[--text-muted]" />
                <span class="font-semibold text-[--text-secondary] text-12px">关于与反馈</span>
              </div>
              <span class="text-10px font-mono px-6px py-1px rounded bg-[--bg-subtle] text-[--text-secondary] font-semibold border border-[--border-subtle]">v1.0.1</span>
            </div>

            <div class="grid grid-cols-2 gap-8px text-12px">
              <a
                href="https://github.com/markcraft-dev/markcraft"
                target="_blank"
                class="flex items-center justify-center gap-6px p-7px rounded-lg border border-[--border-subtle] bg-[--bg-subtle] hover:bg-[--bg-hover] text-[--text-primary] transition-colors no-underline"
              >
                <span>GitHub 仓库</span>
                <SvgIcon name="external-link" class="w-3.5 h-3.5 text-[--text-muted]" />
              </a>
              <a
                href="https://github.com/markcraft-dev/markcraft/issues"
                target="_blank"
                class="flex items-center justify-center gap-6px p-7px rounded-lg border border-[--border-subtle] bg-[--bg-subtle] hover:bg-[--bg-hover] text-[--primary-color] font-medium transition-colors no-underline"
              >
                <span>提交问题 / 反馈</span>
                <SvgIcon name="external-link" class="w-3.5 h-3.5" />
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
import CustomSelect, { type SelectOption } from '@/components/CustomSelect.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { useStorage } from '@/shared/storage'
import { DEFAULT_SETTINGS } from '@/shared/constants'
import { applyTheme, applyCustomStyles } from '../core/theme'

const fontOptions: SelectOption[] = [
  { value: 'Default', label: '系统默认', subLabel: 'System' },
  { value: 'Inter', label: 'Inter', subLabel: '无衬线' },
  { value: 'Roboto', label: 'Roboto', subLabel: '现代' },
  { value: 'Merriweather', label: 'Merriweather', subLabel: '衬线' },
  { value: 'NotoSerifSC', label: '思源宋体', subLabel: '宋体' }
]

const sizeOptions: SelectOption[] = [
  { value: 'Small', label: '小号', subLabel: '14px' },
  { value: 'Normal', label: '标准', subLabel: '16px' },
  { value: 'Medium', label: '中等', subLabel: '18px' },
  { value: 'Large', label: '大号', subLabel: '20px' },
  { value: 'Extra Large', label: '特大', subLabel: '24px' }
]

interface ThemeOption {
  id: 'auto' | 'light' | 'sepia' | 'verdant' | 'dark' | 'nordic' | 'dracula'
  label: string
  desc: string
  icon: string
  iconColor?: string
  previewBg: string
  previewBorder: string
  previewPrimary: string
  previewText: string
}

const themeOptions: ThemeOption[] = [
  {
    id: 'auto',
    label: '跟随系统',
    desc: '自动切换明暗',
    icon: 'device-auto',
    previewBg: 'linear-gradient(135deg, #ffffff 50%, #0b0f17 50%)',
    previewBorder: 'rgba(128, 128, 128, 0.2)',
    previewPrimary: '#3b82f6',
    previewText: '#64748b'
  },
  {
    id: 'light',
    label: '极简工作室',
    desc: '冷冽专注工程白',
    icon: 'sun',
    iconColor: 'text-amber-500',
    previewBg: '#ffffff',
    previewBorder: 'rgba(0, 0, 0, 0.1)',
    previewPrimary: '#2563eb',
    previewText: '#18181b'
  },
  {
    id: 'sepia',
    label: '温润羊皮纸',
    desc: '实体书感柔和护眼',
    icon: 'sun',
    iconColor: 'text-amber-600',
    previewBg: '#faf7f0',
    previewBorder: 'rgba(90, 70, 45, 0.15)',
    previewPrimary: '#b45309',
    previewText: '#2d261e'
  },
  {
    id: 'dark',
    label: '深空极夜',
    desc: '宇宙靛蓝沉浸夜览',
    icon: 'moon',
    iconColor: 'text-indigo-400',
    previewBg: '#0b0f17',
    previewBorder: 'rgba(255, 255, 255, 0.12)',
    previewPrimary: '#60a5fa',
    previewText: '#f1f5f9'
  },
  {
    id: 'verdant',
    label: '豆沙护眼',
    desc: '经典豆沙绿长时间阅读',
    icon: 'sun',
    iconColor: 'text-emerald-500',
    previewBg: '#cce8cf',
    previewBorder: 'rgba(47, 90, 52, 0.2)',
    previewPrimary: '#3a7d44',
    previewText: '#2f3b30'
  },
  {
    id: 'nordic',
    label: '北欧冷雾',
    desc: 'Nord 官方霜蓝低饱和',
    icon: 'moon',
    iconColor: 'text-sky-400',
    previewBg: '#2e3440',
    previewBorder: 'rgba(136, 192, 208, 0.25)',
    previewPrimary: '#88c0d0',
    previewText: '#eceff4'
  },
  {
    id: 'dracula',
    label: '妖紫魅夜',
    desc: 'Dracula 紫夜高对比',
    icon: 'moon',
    iconColor: 'text-purple-400',
    previewBg: '#282a36',
    previewBorder: 'rgba(189, 147, 249, 0.3)',
    previewPrimary: '#bd93f9',
    previewText: '#f8f8f2'
  }
]

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'theme-changed', theme: 'auto' | 'light' | 'sepia' | 'verdant' | 'dark' | 'nordic' | 'dracula'): void }>()

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

function setTheme(theme: 'auto' | 'light' | 'sepia' | 'verdant' | 'dark' | 'nordic' | 'dracula') {
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
