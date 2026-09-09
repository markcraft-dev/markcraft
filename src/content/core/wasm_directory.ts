export interface ParsedDirectoryItem {
  name: string
  path: string
  is_folder: boolean
  size: number
  size_unit: string
  timestamp: number
  date: string
}

type WasmModule = { default: () => Promise<unknown>; parse_directory: (source: string) => ParsedDirectoryItem[] }
let wasmPromise: Promise<WasmModule | null> | null = null

function parseDirectoryFallback(source: string): ParsedDirectoryItem[] {
  const rowRegex = /addRow\("(.*?)",\s*"(.*?)",\s*(\d+),\s*(\d+),\s*"([\d.]+ [BkMG]B?)",\s*(\d+),\s*"(.*?)"\);/g
  const items: ParsedDirectoryItem[] = []
  let match: RegExpExecArray | null
  while ((match = rowRegex.exec(source)) !== null) {
    items.push({ name: match[1], path: match[2], is_folder: Number.parseInt(match[3]) !== 0, size: Number.parseInt(match[4]), size_unit: match[5], timestamp: Number.parseInt(match[6]), date: match[7] })
  }
  return items
}

async function loadWasm(): Promise<WasmModule | null> {
  if (!wasmPromise) {
    const wasmUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('content/wasm/markdown_analyzer.js')
      : '../wasm/markdown_analyzer.js'
    wasmPromise = import(/* @vite-ignore */ wasmUrl).then((module) => module as unknown as WasmModule).catch(() => null)
  }
  return wasmPromise
}

export async function parseDirectory(source: string): Promise<ParsedDirectoryItem[]> {
  const wasm = await loadWasm()
  if (wasm) {
    try { await wasm.default(); const result = wasm.parse_directory(source); if (Array.isArray(result)) return result } catch { /* 回退到 JS */ }
  }
  return parseDirectoryFallback(source)
}
