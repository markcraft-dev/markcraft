<template>
  <div class="popup-container p-16px bg-[--bg-page] text-[--text-primary] select-none">
    <!-- Header -->
    <div class="flex items-center justify-between pb-12px mb-14px border-b border-[--border-color]">
      <div class="flex items-center gap-8px">
        <img src="/assets/logo.png" alt="Logo" class="w-22px h-22px rounded" />
        <span class="font-bold text-14px">MarkCraft</span>
      </div>
      <button
        class="flex items-center gap-4px text-12px text-[--primary-color] hover:text-[--primary-hover] transition-colors cursor-pointer border-0 outline-none bg-transparent"
        @click="openOptions"
      >
        <SvgIcon name="settings" class="w-3.5 h-3.5"  />
        <span>设置</span>
      </button>
    </div>

    <!-- Theme Switcher -->
    <div class="mb-16px">
      <label class="block text-12px font-medium mb-6px text-[--text-secondary]">意境调色盘</label>
      <div class="grid grid-cols-3 gap-4px text-11px bg-[--bg-subtle] p-3px rounded-xl border border-[--border-subtle]">
        <button
          v-for="mode in (['auto', 'light', 'sepia', 'verdant', 'dark', 'nordic', 'dracula'] as const)"
          :key="mode"
          class="flex items-center justify-center gap-3px py-5px rounded-lg transition-all text-center cursor-pointer border-0 outline-none"
          :class="settings.pageTheme === mode ? 'bg-[--bg-page] text-[--primary-color] font-semibold shadow-xs' : 'bg-transparent text-[--text-secondary] hover:text-[--text-primary]'"
          @click="setTheme(mode)"
        >
          <SvgIcon name="device-auto" v-if="mode === 'auto'" class="w-3.5 h-3.5" />
          <SvgIcon name="sun" v-else-if="mode === 'light'" class="w-3.5 h-3.5 text-amber-500" />
          <SvgIcon name="sun" v-else-if="mode === 'sepia'" class="w-3.5 h-3.5 text-amber-600" />
          <SvgIcon name="moon" v-else-if="mode === 'dark'" class="w-3.5 h-3.5 text-indigo-400" />
          <SvgIcon name="moon" v-else class="w-3.5 h-3.5 text-sky-400" />
          <span>{{ mode === 'auto' ? '自动' : mode === 'light' ? '工作' : mode === 'sepia' ? '纸书' : mode === 'verdant' ? '护眼' : mode === 'dark' ? '极夜' : mode === 'nordic' ? '冷雾' : '魅夜' }}</span>
        </button>
      </div>
    </div>

    <!-- Font Size -->
    <div class="mb-16px">
      <label class="block text-12px font-medium mb-6px text-[--text-secondary]">正文字号</label>
      <CustomSelect
        v-model="settings.textSize"
        :options="sizeSelectOptions"
        @change="saveChanges"
      />
    </div>

    <!-- Quick Features Switch -->
    <div class="pt-12px border-t border-[--border-color] text-12px flex flex-col gap-10px text-[--text-secondary]">
      <label class="flex items-center justify-between cursor-pointer hover:text-[--text-primary] transition-colors">
        <span>自适应居中排版</span>
        <input v-model="settings.enableCustomContentWidth" type="checkbox" class="accent-blue-500 cursor-pointer" @change="handleWidthToggle" />
      </label>
      <label class="flex items-center justify-between cursor-pointer hover:text-[--text-primary] transition-colors">
        <span>KaTeX 数学公式渲染</span>
        <input :checked="isPluginActive('Katex')" type="checkbox" class="accent-blue-500 cursor-pointer" @change="togglePlugin('Katex')" />
      </label>
      <label class="flex items-center justify-between cursor-pointer hover:text-[--text-primary] transition-colors">
        <span>Mermaid 图表渲染</span>
        <input :checked="isPluginActive('Mermaid')" type="checkbox" class="accent-blue-500 cursor-pointer" @change="togglePlugin('Mermaid')" />
      </label>
    </div>

    <!-- Local file access (T25): without this toggle the content script never
      injects into file:// pages, so toggle education lives here — the popup
      cannot open chrome://extensions, text guidance only. -->
    <div class="pt-12px mt-12px border-t border-[--border-color] text-12px">
      <div class="flex items-center justify-between mb-6px">
        <span class="font-medium text-[--text-secondary]">本地文件访问</span>
        <span v-if="fileAccess === null" class="text-[--text-muted]">检测中…</span>
        <span v-else-if="fileAccess" class="font-semibold" style="color: #16a34a">已开启</span>
        <span v-else class="font-semibold" style="color: #d97706">未开启</span>
      </div>
      <div v-if="fileAccess === true" class="text-11px text-[--text-muted] leading-relaxed">
        双击 md 可直接阅读，侧栏可列出同目录文档。
      </div>
      <div v-else-if="fileAccess === false" class="text-11px text-[--text-muted] leading-relaxed">
        <p class="mb-4px">双击打开的 md 只显示原文？请开启后重开文件：</p>
        <ol class="pl-16px list-decimal space-y-2px">
          <li>打开 chrome://extensions，找到 MarkCraft</li>
          <li>点「详情」→ 打开「允许访问文件网址」</li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue'
import CustomSelect, { type SelectOption } from '@/components/CustomSelect.vue'
import { onMounted, ref } from 'vue'
import { useStorage } from '@/shared/storage'

const sizeSelectOptions: SelectOption[] = [
  { value: 'Small', label: '小号', subLabel: '14px' },
  { value: 'Normal', label: '标准', subLabel: '16px' },
  { value: 'Medium', label: '中等', subLabel: '18px' },
  { value: 'Large', label: '大号', subLabel: '20px' },
  { value: 'Extra Large', label: '特大', subLabel: '24px' }
]

const { settings, loadSettings, saveSettings } = useStorage()

function isPluginActive(p: string): boolean {
  return Array.isArray(settings.value?.mdPlugins) && settings.value.mdPlugins.includes(p)
}

function setTheme(theme: 'auto' | 'light' | 'sepia' | 'verdant' | 'dark' | 'nordic' | 'dracula') {
  settings.value.pageTheme = theme
  saveSettings({ pageTheme: theme })
}

function togglePlugin(name: string) {
  const current = Array.isArray(settings.value?.mdPlugins) ? [...settings.value.mdPlugins] : []
  const idx = current.indexOf(name)
  if (idx > -1) {
    current.splice(idx, 1)
  } else {
    current.push(name)
  }
  saveSettings({ mdPlugins: current })
}

function saveChanges() {
  saveSettings(settings.value)
}

// 开启时若从未设置过宽度，给默认值 900，否则开关是视觉上的空操作
// （applyCustomStyles 在 contentWidth 缺失时会直接移除变量）
function handleWidthToggle() {
  if (settings.value.enableCustomContentWidth && !settings.value.customContentWidth) {
    settings.value.customContentWidth = 900
  }
  saveChanges()
}

function openOptions() {
  chrome.runtime.openOptionsPage()
}

// T25: file-URL toggle status — no new permission needed, plain callback API.
// Unknown/error state stays null ("检测中…") rather than misreporting.
const fileAccess = ref<boolean | null>(null)

onMounted(() => {
  loadSettings()
  try {
    chrome.extension?.isAllowedFileSchemeAccess?.((allowed: boolean) => {
      fileAccess.value = !!allowed
    })
  } catch {
    fileAccess.value = null
  }
})
</script>

<style scoped>
.popup-container {
  --bg-page: #ffffff;
  --bg-subtle: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-color: #e2e8f0;
  --border-subtle: #f1f5f9;
  --primary-color: #3b82f6;
  --primary-hover: #2563eb;
}

@media (prefers-color-scheme: dark) {
  .popup-container {
    --bg-page: #0f172a;
    --bg-subtle: #1e293b;
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #64748b;
    --border-color: #1e293b;
    --border-subtle: #334155;
    --primary-color: #60a5fa;
    --primary-hover: #93c5fd;
  }
}
</style>
