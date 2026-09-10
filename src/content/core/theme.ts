export type PageTheme = 'auto' | 'light' | 'sepia' | 'verdant' | 'dark' | 'nordic' | 'dracula'

export function applyTheme(theme: PageTheme) {
  let effectiveTheme = theme
  if (theme === 'auto') {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    effectiveTheme = isDark ? 'dark' : 'light'
  }
  document.documentElement.dataset.mdrTheme = effectiveTheme
}

const FONT_FAMILY_MAP: Record<string, string> = {
  Default: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  Inter: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  Roboto: '"Roboto", -apple-system, BlinkMacSystemFont, sans-serif',
  Merriweather: '"Merriweather", Georgia, "Times New Roman", serif',
  NotoSerifSC: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif'
}

const FONT_SIZE_MAP: Record<string, string> = {
  Tiny: '12px',
  Small: '14px',
  Normal: '16px',
  Medium: '18px',
  Large: '20px',
  'Extra Large': '24px'
}

export function applyCustomStyles(
  customCSS?: string,
  contentWidth?: number,
  textFont?: string,
  textSize?: string
) {
  // 1. Font Family
  if (textFont && FONT_FAMILY_MAP[textFont]) {
    document.documentElement.style.setProperty('--mdr-font-family', FONT_FAMILY_MAP[textFont])
  } else {
    document.documentElement.style.setProperty('--mdr-font-family', FONT_FAMILY_MAP.Default)
  }

  // 2. Font Size
  if (textSize && FONT_SIZE_MAP[textSize]) {
    document.documentElement.style.setProperty('--mdr-font-size', FONT_SIZE_MAP[textSize])
  } else {
    document.documentElement.style.setProperty('--mdr-font-size', '16px')
  }

  // 3. Content Max Width（关闭时移除内联变量，立即回落到默认宽度）
  if (contentWidth) {
    document.documentElement.style.setProperty('--content-max-width', `${contentWidth}px`)
  } else {
    document.documentElement.style.removeProperty('--content-max-width')
  }

  // 4. Custom CSS
  let styleEl = document.getElementById('mdr-custom-css')
  if (customCSS && customCSS.trim()) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'mdr-custom-css'
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = customCSS
  } else if (styleEl) {
    styleEl.textContent = ''
  }
}
