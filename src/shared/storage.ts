import { ref } from 'vue'
import { DEFAULT_SETTINGS } from './constants'
import type { UserSettings } from './types'

// 导出供 storage.onChanged 监听方在边界处归一化新值
export function normalizeSettings(raw: any): UserSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) }

  // Guarantee mdPlugins is always a valid Array
  if (!Array.isArray(merged.mdPlugins)) {
    if (typeof merged.mdPlugins === 'string') {
      try {
        const parsed = JSON.parse(merged.mdPlugins)
        merged.mdPlugins = Array.isArray(parsed) ? parsed : merged.mdPlugins.split(',').map((s: string) => s.trim()).filter(Boolean)
      } catch {
        merged.mdPlugins = merged.mdPlugins.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
    } else {
      merged.mdPlugins = [...DEFAULT_SETTINGS.mdPlugins]
    }
  }

  if (!Array.isArray(merged.mdPlugins) || merged.mdPlugins.length === 0) {
    merged.mdPlugins = [...DEFAULT_SETTINGS.mdPlugins]
  }

  return merged
}

function createStorage() {
  const settings = ref<UserSettings>({ ...DEFAULT_SETTINGS } as UserSettings)

  const loadSettings = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const data = await chrome.storage.local.get('settings')
        if (data.settings) {
          settings.value = normalizeSettings(data.settings)
        }
      } catch (e) {
        console.warn('[MarkCraft] Failed to load settings from storage:', e)
        settings.value = { ...DEFAULT_SETTINGS } as UserSettings
      }
    }
  }

  const saveSettings = async (newVal: Partial<UserSettings>) => {
    const next = normalizeSettings({ ...settings.value, ...newVal })
    settings.value = next
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ settings: next })
      } catch (e) {
        console.warn('[MarkCraft] Failed to save settings to storage:', e)
      }
    }
  }

  return {
    settings,
    loadSettings,
    saveSettings
  }
}

// 同一 JS 上下文（内容脚本页 / popup / options）内共享同一实例：
// 每次调用都新建实例会让各实例以「默认设置 + 局部改动」整体写回 chrome.storage，
// 把其他组件已保存的自定义设置静默覆盖掉。
let sharedStorage: ReturnType<typeof createStorage> | null = null

export function useStorage() {
  if (!sharedStorage) {
    sharedStorage = createStorage()
  }
  return sharedStorage
}
