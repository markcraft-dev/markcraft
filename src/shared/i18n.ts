export function t(key: string, defaultVal: string = ''): string {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const msg = chrome.i18n.getMessage(key)
    if (msg) return msg
  }
  return defaultVal || key
}
