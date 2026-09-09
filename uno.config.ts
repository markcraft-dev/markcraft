import { defineConfig, presetAttributify, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons()
  ],
  shortcuts: {
    'btn-icon': 'cursor-pointer select-none text-base opacity-70 hover:opacity-100 transition-opacity'
  }
})
