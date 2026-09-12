// Service Worker for MarkCraft

import { fileUrlToNativePath } from '../content/core/native-save'

// 单次写入内容上限（字符数）：远超任何现实文档，防御异常/被攻破上下文的滥用
const NATIVE_SAVE_MAX_CONTENT_CHARS = 64 * 1024 * 1024
// 宿主响应基础超时：按内容长度放大（与内容侧 native-save.ts 口径一致）
const NATIVE_SAVE_BASE_TIMEOUT_MS = 4_000

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'bg-fetch' || request.action === 'bg-fetch') {
    const url = request.url || request.data?.url
    fetch(url)
      .then(async (response) => {
        try {
          const text = await response.text()
          const isOk = response.ok || response.status === 0 || response.status === 200
          sendResponse({ ok: isOk, res: text, status: response.status })
        } catch (e: any) {
          sendResponse({ ok: false, msg: e.message })
        }
      })
      .catch((err) => {
        sendResponse({ ok: false, msg: err.message })
      })
    return true
  }

  if (request.type === 'native-save') {
    // 内容脚本不能直连 connectNative，由 SW 中继到本机写入宿主。
    // 纵深防御：中继前校验——仅接受本扩展上下文消息；path 必须与请求声明的
    // file:// 来源 URL 推导出的绝对路径一致；内容为字符串且不超过大小上限。
    let responded = false
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined
    const respond = (msg: unknown) => {
      if (!responded) {
        responded = true
        if (timeoutTimer !== undefined) clearTimeout(timeoutTimer)
        sendResponse(msg)
      }
    }
    const path = typeof request.path === 'string' ? request.path : ''
    const content = typeof request.content === 'string' ? request.content : null
    const sourceUrl = typeof request.sourceUrl === 'string' ? request.sourceUrl : ''
    const senderId = (sender as { id?: string }).id

    if (
      senderId !== chrome.runtime.id ||
      content === null ||
      content.length > NATIVE_SAVE_MAX_CONTENT_CHARS ||
      !sourceUrl.startsWith('file://') ||
      !path.startsWith('/') ||
      path !== fileUrlToNativePath(sourceUrl)
    ) {
      respond({ ok: false, error: 'native-save request rejected' })
      return true
    }

    try {
      const port = chrome.runtime.connectNative('com.markcraft.filewriter')
      port.onMessage.addListener((msg) => {
        respond(msg)
        port.disconnect()
      })
      port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError?.message
        respond({ ok: false, error: err || 'native host disconnected' })
      })
      // 超时断开：按内容长度放大（每 1M 字符 +2s，上限 60s）。宿主挂起时
      // 主动断开 port 防止资源滞留；内容侧超时同步放大，避免「扩展已回退
      // 弹窗、宿主迟到写入」的双写窗口
      const timeoutMs = Math.min(
        60_000,
        NATIVE_SAVE_BASE_TIMEOUT_MS + Math.floor(content.length / 1_000_000) * 2_000
      )
      timeoutTimer = setTimeout(() => {
        try {
          port.disconnect()
        } catch {
          // 已断开
        }
        respond({ ok: false, error: 'native host timeout' })
      }, timeoutMs)
      port.postMessage({ path, content })
    } catch (e: any) {
      respond({ ok: false, error: e?.message || String(e) })
    }
    return true
  }

  if (
    request.type === 'bg-task' ||
    request.action === 'bg-task' ||
    request.action === 'open-options-page' ||
    request.type === 'open-options-page'
  ) {
    chrome.runtime.openOptionsPage()
    sendResponse({ ok: true })
    return true
  }
})

// Shortcut command handlers
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'command', command })
    }
  })
})
