<template>
  <div class="options-wrapper min-h-screen bg-[--bg-subtle] text-[--text-primary] py-40px px-16px select-none">
    <div class="options-container max-w-760px mx-auto bg-[--bg-page] rounded-2xl shadow-sm border border-[--border-color] p-32px">
      <!-- Header -->
      <div class="flex items-center gap-14px pb-24px mb-28px border-b border-[--border-color]">
        <img src="/assets/logo.png" alt="Logo" class="w-44px h-44px rounded-xl shadow-sm" />
        <div>
          <h1 class="text-20px font-bold text-[--text-primary] tracking-tight">MarkCraft 偏好设置</h1>
          <p class="text-13px text-[--text-muted]">定制专属的 Markdown 排版、字体、渲染与编辑特性</p>
        </div>
      </div>

      <!-- Section: Appearance & Typography -->
      <section class="mb-32px">
        <h2 class="text-14px font-semibold text-[--text-primary] mb-14px uppercase tracking-wider text-[--text-muted]">外观与排版</h2>
        <div class="grid grid-cols-2 gap-16px text-13px">
          <div class="p-16px rounded-xl bg-[--bg-subtle] border border-[--border-subtle]">
            <label class="block font-medium text-[--text-secondary] mb-8px">默认主题</label>
            <CustomSelect
              v-model="settings.pageTheme"
              :options="themeSelectOptions"
              @change="saveChanges"
            />
          </div>

          <div class="p-16px rounded-xl bg-[--bg-subtle] border border-[--border-subtle]">
            <label class="block font-medium text-[--text-secondary] mb-8px">阅读字体</label>
            <CustomSelect
              v-model="settings.textFont"
              :options="fontSelectOptions"
              @change="saveChanges"
            />
          </div>
        </div>
      </section>

      <!-- Section: Markdown Plugins -->
      <section class="mb-32px">
        <h2 class="text-14px font-semibold text-[--text-primary] mb-14px uppercase tracking-wider text-[--text-muted]">Markdown 渲染生态</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-10px text-13px">
          <label
            v-for="plugin in allPlugins"
            :key="plugin"
            class="flex items-center gap-8px p-12px rounded-xl border border-[--border-subtle] bg-[--bg-subtle] hover:bg-[--bg-hover] cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              :checked="isPluginActive(plugin)"
              class="accent-blue-500 cursor-pointer w-4 h-4 rounded"
              @change="togglePlugin(plugin)"
            />
            <span class="font-medium text-[--text-secondary]">{{ plugin }}</span>
          </label>
        </div>
      </section>

      <!-- Section: Custom CSS -->
      <section class="mb-24px">
        <div class="flex items-center justify-between mb-10px">
          <h2 class="text-14px font-semibold text-[--text-primary] uppercase tracking-wider text-[--text-muted]">自定义 CSS 覆盖</h2>
          <label class="flex items-center gap-6px text-13px text-[--text-secondary] cursor-pointer">
            <input v-model="settings.enableCustomCSS" type="checkbox" class="accent-blue-500 cursor-pointer" @change="saveChanges" />
            <span>启用自定义样式</span>
          </label>
        </div>
        <textarea
          v-model="settings.customCSS"
          rows="5"
          placeholder="/* 在此输入 CSS 覆盖默认样式，例如：.mdr-content h1 { color: #3b82f6; } */"
          class="w-full p-12px font-mono text-12px rounded-xl border border-[--border-color] bg-[--bg-subtle] text-[--text-primary] focus:outline-none focus:border-[--primary-color]"
          @input="saveChanges"
        ></textarea>
      </section>

      <!-- Footer Note -->
      <div class="pt-16px border-t border-[--border-color] text-12px text-[--text-muted] text-center">
        所有配置更改将自动保存并立即同步到所有 MarkCraft 窗口
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import CustomSelect, { type SelectOption } from '@/components/CustomSelect.vue'
import { useStorage } from '@/shared/storage'
import { DEFAULT_PLUGINS } from '@/shared/constants'

const themeSelectOptions: SelectOption[] = [
  { value: 'auto', label: '跟随系统', subLabel: 'Auto' },
  { value: 'light', label: '极简工作室', subLabel: 'Zinc' },
  { value: 'sepia', label: '温润羊皮纸', subLabel: 'Paper' },
  { value: 'dark', label: '深空极夜', subLabel: 'Indigo' },
  { value: 'verdant', label: '豆沙护眼', subLabel: 'Verdant' },
  { value: 'nordic', label: '北欧冷雾', subLabel: 'Nord' },
  { value: 'dracula', label: '妖紫魅夜', subLabel: 'Dracula' }
]

const fontSelectOptions: SelectOption[] = [
  { value: 'Default', label: '系统默认', subLabel: 'System' },
  { value: 'Inter', label: 'Inter', subLabel: '无衬线' },
  { value: 'Roboto', label: 'Roboto', subLabel: '现代' },
  { value: 'Merriweather', label: 'Merriweather', subLabel: '衬线' },
  { value: 'NotoSerifSC', label: '思源宋体', subLabel: '宋体' }
]

const { settings, loadSettings, saveSettings } = useStorage()
const allPlugins = DEFAULT_PLUGINS

function isPluginActive(p: string): boolean {
  return Array.isArray(settings.value?.mdPlugins) && settings.value.mdPlugins.includes(p)
}

function togglePlugin(plugin: string) {
  const list = Array.isArray(settings.value?.mdPlugins) ? [...settings.value.mdPlugins] : []
  const idx = list.indexOf(plugin)
  if (idx > -1) {
    list.splice(idx, 1)
  } else {
    list.push(plugin)
  }
  settings.value.mdPlugins = list
  saveChanges()
}

function saveChanges() {
  saveSettings(settings.value)
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.options-wrapper {
  --bg-page: #ffffff;
  --bg-subtle: #f8fafc;
  --bg-hover: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-color: #e2e8f0;
  --border-subtle: #edf2f7;
  --primary-color: #3b82f6;
}

@media (prefers-color-scheme: dark) {
  .options-wrapper {
    --bg-page: #0f172a;
    --bg-subtle: #090d16;
    --bg-hover: #1e293b;
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #64748b;
    --border-color: #1e293b;
    --border-subtle: #1e293b;
    --primary-color: #60a5fa;
  }
}
</style>
