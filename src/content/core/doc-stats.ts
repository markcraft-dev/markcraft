// 文档统计（词数 / 预计阅读时长）：计算位于 Rust（doc_stats），
// 失败时回退到本地实现；两侧均为「CJK 按字计、其余按词计」的口径。
import { loadAnalyzer } from './wasm_analyzer'

export interface DocStats {
  words: number
  minutes: number
}

/** CJK 表意/音节字符（含中日韩标点）：按字计数，不参与拉丁词聚合。 */
function isCjk(code: number): boolean {
  return (
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff)
  )
}

function computeDocStatsFallback(raw: string): DocStats {
  // CJK 按字计、其余连续非空白串按词计（与 WASM 版口径一致），
  // 纯英文文档的阅读时长不再被字符数高估约 5 倍
  let words = 0
  let inWord = false
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0
    if (/\s/.test(ch) || code === 0xfeff) {
      inWord = false
      continue
    }
    if (isCjk(code)) {
      words += 1
      inWord = false
      continue
    }
    if (!inWord) {
      words += 1
      inWord = true
    }
  }
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
