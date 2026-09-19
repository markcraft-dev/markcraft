// 统一的 WASM 核心算法加载器：加载、初始化失败时返回 null，
// 各调用方据此回退到本地 JS 实现，保证扩展在无 WASM 环境下仍可用。

export interface WasmAnalyzer {
  default: () => Promise<unknown>
  parse_directory: (source: string) => unknown
  filter_directory: (source: string) => unknown
  scan_directory: (source: string, baseUrl: string) => unknown
  ancestor_folder_urls: (rootUrl: string, targetFileUrl: string) => unknown
  build_outline: (headings: unknown, maxLevel: number) => unknown
  search_palette: (files: unknown, headings: unknown, query: string) => unknown
  fulltext_index_build: (docs: unknown) => unknown
  fulltext_search: (query: string, limit: number) => unknown
  dom_to_markdown: (dom: unknown) => unknown
  doc_stats: (raw: string) => unknown
}

let wasmPromise: Promise<WasmAnalyzer | null> | null = null

export function loadAnalyzer(): Promise<WasmAnalyzer | null> {
  if (!wasmPromise) {
    const wasmUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('content/wasm/markdown_analyzer.js')
      : '../wasm/markdown_analyzer.js'
    wasmPromise = import(/* @vite-ignore */ wasmUrl)
      .then(async (module) => {
        const analyzer = module as unknown as WasmAnalyzer
        // 统一在此完成一次性初始化：导出函数依赖模块级 wasm 实例，
        // 未初始化就调用会直接 TypeError（此前只有目录解析路径初始化过）
        await analyzer.default()
        return analyzer
      })
      .catch((err) => {
        // 加载或初始化失败：缓存 null 短路，所有调用方统一走 JS 回退
        console.debug('[MarkCraft] WASM analyzer unavailable, using JS fallback:', err)
        return null
      })
  }
  return wasmPromise
}
