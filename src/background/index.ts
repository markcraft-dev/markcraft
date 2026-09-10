// Service Worker for MarkCraft

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
    // 内容脚本不能直连 connectNative，由 SW 中继到本机写入宿主
    let responded = false
    const respond = (msg: unknown) => {
      if (!responded) {
        responded = true
        sendResponse(msg)
      }
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
      port.postMessage({ path: request.path, content: request.content })
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
