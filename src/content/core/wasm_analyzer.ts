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
      .then((module) => module as unknown as WasmAnalyzer)
      .catch(() => null)
  }
  return wasmPromise
}
