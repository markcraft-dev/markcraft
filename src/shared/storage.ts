import { ref } from 'vue'
import { DEFAULT_SETTINGS } from './constants'
import type { UserSettings } from './types'

function normalizeSettings(raw: any): UserSettings {
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

export function useStorage() {
  const settings = ref<UserSettings>({ ...DEFAULT_SETTINGS } as UserSettings)

  const loadSettings = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const data = await chrome.storage.local.get('settings')
        if (data.settings) {
          settings.value = normalizeSettings(data.settings)
        }
      } catch (e) {
        console.warn('[Markdown Reader] Failed to load settings from storage:', e)
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
        console.warn('[Markdown Reader] Failed to save settings to storage:', e)
      }
    }
  }

  return {
    settings,
    loadSettings,
    saveSettings
  }
}
