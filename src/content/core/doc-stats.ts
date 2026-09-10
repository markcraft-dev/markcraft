// 文档统计（字数 / 预计阅读时长）：口径与 JS 版一致，
// 计算位于 Rust（doc_stats），失败时回退到本地实现。
import { loadAnalyzer } from './wasm_analyzer'

export interface DocStats {
  words: number
  minutes: number
}

function computeDocStatsFallback(raw: string): DocStats {
  const clean = raw.replace(/[\s\r\n\t]+/g, '')
  const words = clean.length
  return { words, minutes: Math.max(1, Math.ceil(words / 400)) }
}

export async function computeDocStats(raw: string): Promise<DocStats> {
  const analyzer = await loadAnalyzer()
  if (analyzer) {
    try {
      const stats = analyzer.doc_stats(raw) as Partial<DocStats> | null
      if (stats && typeof stats.words === 'number' && typeof stats.minutes === 'number') {
        return { words: stats.words, minutes: stats.minutes }
      }
    } catch {
      // 回退到 JS 实现
    }
  }
  return computeDocStatsFallback(raw)
}
