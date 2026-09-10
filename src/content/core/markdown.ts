import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import katexPlugin from '@traptitech/markdown-it-katex'
import { alert as alertPlugin } from '@mdit/plugin-alert'
import taskListsPlugin from 'markdown-it-task-lists'
import multimdTablePlugin from 'markdown-it-multimd-table'
import { full as emojiPlugin } from 'markdown-it-emoji'
import subPlugin from 'markdown-it-sub'
import supPlugin from 'markdown-it-sup'
import insPlugin from 'markdown-it-ins'
import markPlugin from 'markdown-it-mark'
import deflistPlugin from 'markdown-it-deflist'
import abbrPlugin from 'markdown-it-abbr'
import footnotePlugin from 'markdown-it-footnote'
import mermaid from 'mermaid'

let mdInstance: MarkdownIt | null = null
// 当前实例对应的插件签名；设置变化时按需重建渲染器
let activeSignature = ''
// Mermaid 经 highlight 钩子渲染，需在钩子内感知开关状态
let mermaidEnabled = true

export function initMarkdownRenderer(activePlugins: string[] = [], pluginOptions: Record<string, any> = {}): MarkdownIt {
  // 空集合视为「全部启用」，保持向后兼容
  const enabled = new Set(activePlugins)
  const isEnabled = (name: string) => enabled.size === 0 || enabled.has(name)
  mermaidEnabled = isEnabled('Mermaid')

  const md = new MarkdownIt({
    html: true,
    // Linkify 开关
    linkify: isEnabled('Linkify'),
    typographer: true,
    highlight: (str, lang) => {
      if (lang && mermaidEnabled && lang.toLowerCase() === 'mermaid') {
        // 源码写入 data-mermaid-source，供 WASM 版 dom_to_markdown 还原 Mermaid 代码块
        return `<div class="mermaid" data-mermaid-source="${md.utils.escapeHtml(str)}">${md.utils.escapeHtml(str)}</div>`
      }
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
        } catch (__) {}
      }
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
    }
  })

  // 按设置注册扩展插件（TOC / FrontMatter 暂无实现，保持无操作）
  if (isEnabled('Emoji')) md.use(emojiPlugin)
  if (isEnabled('Sub')) md.use(subPlugin)
  if (isEnabled('Sup')) md.use(supPlugin)
  if (isEnabled('Ins')) md.use(insPlugin)
  if (isEnabled('Mark')) md.use(markPlugin)
  md.use(deflistPlugin)
  md.use(abbrPlugin)
  md.use(footnotePlugin)
  if (isEnabled('TaskLists')) md.use(taskListsPlugin, { enabled: true, label: true, labelAfter: true })
  if (isEnabled('MultimdTable')) md.use(multimdTablePlugin, { multiline: true, rowspan: true, headerless: true })
  if (isEnabled('Alert')) md.use(alertPlugin)
  if (isEnabled('Katex')) md.use(katexPlugin, { throwOnError: false, errorColor: '#cc0000' })

  mdInstance = md
  return md
}

export function renderMarkdown(rawText: string, activePlugins?: string[]): string {
  if (!activePlugins) {
    // 未指定插件集合：沿用现有实例（首调用时以全启用初始化）
    if (!mdInstance) {
      initMarkdownRenderer()
    }
    return mdInstance!.render(rawText)
  }

  const signature = [...activePlugins].sort().join(',')
  if (!mdInstance || signature !== activeSignature) {
    initMarkdownRenderer(activePlugins)
    activeSignature = signature
  }
  return mdInstance!.render(rawText)
}

export async function renderMermaidDiagrams() {
  if (!mermaidEnabled) return
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.dataset.mdrTheme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose'
    })
    await mermaid.run({
      querySelector: '.mermaid'
    })
  } catch (e) {
    console.warn('Mermaid rendering failed:', e)
  }
}
