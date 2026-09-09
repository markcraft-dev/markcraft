import { createApp } from 'vue'
import App from './App.vue'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'
import './styles/markdown.css'
import 'uno.css'

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.mkd', '.mdc'])

function isMarkdownPath(pathname: string): boolean {
  const cleanPath = pathname.split('?')[0].split('#')[0].toLowerCase()
  const lastDotIndex = cleanPath.lastIndexOf('.')
  if (lastDotIndex === -1) return false
  const ext = cleanPath.slice(lastDotIndex)
  return MARKDOWN_EXTENSIONS.has(ext)
}

function isRawMarkdownDocument(isLocal: boolean, contentType: string | undefined, hasPreformattedContent: boolean): boolean {
  if (isLocal) return true

  // 远程站点经常使用 .md 路径提供已经渲染好的 HTML 页面（例如代码托管平台）。
  // 只有明确返回文本，或明确呈现为原始文本的 <pre> 页面，才交给阅读器接管。
  const normalizedType = contentType?.split(';', 1)[0].trim().toLowerCase()
  if (normalizedType === 'text/markdown' || normalizedType === 'text/plain') return true
  return normalizedType === 'application/octet-stream' && hasPreformattedContent
}

function init() {
  // 1. Explicitly ignore non-text / PDF content types and media
  if (
    document.contentType === 'application/pdf' ||
    document.contentType?.startsWith('image/') ||
    document.contentType?.startsWith('video/') ||
    document.contentType?.startsWith('audio/')
  ) {
    return
  }

  const isLocal = window.location.protocol === 'file:'
  const rawPath = window.location.pathname
  const cleanPath = rawPath.split('?')[0].split('#')[0]

  const isMd = isMarkdownPath(cleanPath)
  const isDir = isLocal && (cleanPath.endsWith('/') || !cleanPath.slice(cleanPath.lastIndexOf('/') + 1).includes('.'))

  const preEl = document.querySelector('pre')

  // 远程 .md HTML 页面可能是平台渲染结果，不能仅凭后缀覆盖原页面。
  if (isMd && !isRawMarkdownDocument(isLocal, document.contentType, Boolean(preEl))) {
    return
  }

  // If not a markdown file and not a local directory, NEVER touch DOM or inject styles
  if (!isMd && !isDir) {
    return
  }

  // Double check: if it has an extension and it's NOT a markdown extension, skip!
  const filename = cleanPath.slice(cleanPath.lastIndexOf('/') + 1)
  if (filename.includes('.')) {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
    if (!MARKDOWN_EXTENSIONS.has(ext)) {
      return
    }
  }

  // Set required attributes for Markdown Reader stylesheet
  document.documentElement.setAttribute('mdr-loaded', '')
  document.body.classList.add('mdr', 'mdr-pre')

  // Extract raw markdown content from <pre> if viewing a file
  let rawContent = ''

  if (preEl) {
    rawContent = preEl.innerText
  } else if (!isDir) {
    rawContent = document.body.innerText
  } else {
    rawContent = '# 文件夹目录\n\n请在左侧侧边栏中选择要阅读的 Markdown 文件。'
  }

  // Create and append root container safely without wiping body.innerHTML
  let rootEl = document.getElementById('mdr-root')
  if (!rootEl) {
    rootEl = document.createElement('div')
    rootEl.id = 'mdr-root'
    document.body.appendChild(rootEl)
  }

  const app = createApp(App, { initialContent: rawContent })
  app.mount(rootEl)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
