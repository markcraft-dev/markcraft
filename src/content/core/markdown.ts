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

export function initMarkdownRenderer(activePlugins: string[] = [], pluginOptions: Record<string, any> = {}): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
      if (lang && lang.toLowerCase() === 'mermaid') {
        return `<div class="mermaid">${md.utils.escapeHtml(str)}</div>`
      }
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
        } catch (__) {}
      }
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
    }
  })

  // Register core & extension plugins
  md.use(emojiPlugin)
  md.use(subPlugin)
  md.use(supPlugin)
  md.use(insPlugin)
  md.use(markPlugin)
  md.use(deflistPlugin)
  md.use(abbrPlugin)
  md.use(footnotePlugin)
  md.use(taskListsPlugin, { enabled: true, label: true, labelAfter: true })
  md.use(multimdTablePlugin, { multiline: true, rowspan: true, headerless: true })
  md.use(alertPlugin)
  md.use(katexPlugin, { throwOnError: false, errorColor: '#cc0000' })

  mdInstance = md
  return md
}

export function renderMarkdown(rawText: string): string {
  if (!mdInstance) {
    initMarkdownRenderer()
  }
  return mdInstance!.render(rawText)
}

export async function renderMermaidDiagrams() {
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
