// 通过 Native Messaging 宿主（com.markcraft.filewriter）直接覆盖本地原文件，
// 零弹窗。宿主未安装或不可用时返回 false，调用方回退到目录授权/文件对话框。
// 内容脚本不能直连 connectNative，需经 background service worker 中继。

// 宿主响应基础超时：按内容长度放大（每 1M 字符 +2s，上限 60s），与 SW 侧
// 口径一致——超大文档给宿主留足写入时间，避免「扩展已回退弹窗、宿主迟到
// 写入」的双写窗口
const NATIVE_SAVE_BASE_TIMEOUT_MS = 4000

function nativeSaveTimeoutMs(contentLength: number): number {
  return Math.min(
    60_000,
    NATIVE_SAVE_BASE_TIMEOUT_MS + Math.floor(contentLength / 1_000_000) * 2_000
  )
}

/** file:// URL → 本机绝对路径；非本地文件返回 null。 */
export function fileUrlToNativePath(fileUrl: string): string | null {
  if (!fileUrl.startsWith('file://')) return null
  let rest = fileUrl.slice('file://'.length).split('#')[0].split('?')[0]
  if (rest.startsWith('localhost/')) rest = rest.slice('localhost/'.length)
  if (!rest.startsWith('/')) return null
  try {
    rest = decodeURIComponent(rest)
  } catch {
    // 保留未解码形式
  }
  return rest
}

export function tryNativeSave(fileUrl: string, content: string): Promise<boolean> {
  const path = fileUrlToNativePath(fileUrl)
  if (!path) return Promise.resolve(false)

  return new Promise((resolve) => {
    let settled = false
    const done = (value: boolean) => {
      if (!settled) {
        settled = true
        resolve(value)
      }
    }
    // 宿主缺失时 background 可能只触发 onDisconnect，超时兜底防止挂起
    const timer = setTimeout(() => done(false), nativeSaveTimeoutMs(content.length))
    try {
      // sourceUrl 让 SW 中统能校验 path 确由该 file:// 来源 URL 推导（纵深防御）
      chrome.runtime.sendMessage({ type: 'native-save', path, content, sourceUrl: fileUrl }, (res) => {
        clearTimeout(timer)
        void chrome.runtime.lastError
        done(!!(res && (res as { ok?: boolean }).ok))
      })
    } catch {
      clearTimeout(timer)
      done(false)
    }
  })
}
