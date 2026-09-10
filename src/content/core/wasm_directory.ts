import { loadAnalyzer } from './wasm_analyzer'

export interface ParsedDirectoryItem {
  name: string
  path: string
  is_folder: boolean
  size: number
  size_unit: string
  timestamp: number
  date: string
}

type WasmModule = { default: () => Promise<unknown>; parse_directory: (source: string) => unknown }

function parseDirectoryFallback(source: string): ParsedDirectoryItem[] {
  const rowRegex = /addRow\("(.*?)",\s*"(.*?)",\s*(\d+),\s*(\d+),\s*"([\d.]+ [BkMG]B?)",\s*(\d+),\s*"(.*?)"\);/g
  const items: ParsedDirectoryItem[] = []
  let match: RegExpExecArray | null
  while ((match = rowRegex.exec(source)) !== null) {
    items.push({ name: match[1], path: match[2], is_folder: Number.parseInt(match[3]) !== 0, size: Number.parseInt(match[4]), size_unit: match[5], timestamp: Number.parseInt(match[6]), date: match[7] })
  }
  return items
}

export async function parseDirectory(source: string): Promise<ParsedDirectoryItem[]> {
  const wasm = await loadAnalyzer()
  if (wasm) {
    try { await wasm.default(); const result = wasm.parse_directory(source); if (Array.isArray(result)) return result as ParsedDirectoryItem[] } catch { /* 回退到 JS */ }
  }
  return parseDirectoryFallback(source)
}
