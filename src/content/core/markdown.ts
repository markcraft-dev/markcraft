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

// [TOC] 独占段落 → 渲染占位容器（App 随后用大纲数据填充条目）
function tocPlugin(md: MarkdownIt): void {
  md.core.ruler.push('mdr_toc_placeholder', (state) => {
    for (let i = state.tokens.length - 2; i >= 0; i--) {
      const token = state.tokens[i]
      if (
        token.type === 'paragraph_open' &&
        state.tokens[i + 1].type === 'inline' &&
        /^\[toc\]$/i.test(state.tokens[i + 1].content.trim())
      ) {
        const html = new state.Token('html_block', '', 0)
        html.content =
          '<div class="mdr-toc" id="mdr-toc"><div class="mdr-toc-title">目录</div></div>'
        state.tokens.splice(i, 3, html)
      }
    }
  })
}

export function initMarkdownRenderer(activePlugins: string[] = [], pluginOptions: Record<string, any> = {}): MarkdownIt {
  // 空集合视为「全部启用」，保持向后兼容
  const enabled = new Set(activePlugins)
  const isEnabled = (name: string) => enabled.size === 0 || enabled.has(name)
  mermaidEnabled = isEnabled('Mermaid')

  const md = new MarkdownIt({
    // 安全：内容脚本按设计渲染不可信的远程/本地文档。html:false 使源文档中的
    // 原始 HTML 被转义为纯文本展示，渲染产物只包含渲染器自身生成的标记，
    // 配合 v-html 也不会注入宿主页可执行的脚本（raw HTML 渲染不支持且默认关闭）。
    html: false,
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
  if (isEnabled('TOC')) md.use(tocPlugin)

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
      // 安全：strict（默认值）保持 Mermaid 对图标签内 HTML/事件的净化，
      // 防止图表源码中的内嵌标记在宿主页执行。
      securityLevel: 'strict'
    })
    await mermaid.run({
      querySelector: '.mermaid'
    })
  } catch (e) {
    console.warn('Mermaid rendering failed:', e)
  }
}

/**
 * 主题切换后重建图表：mermaid.initialize 的主题在渲染时固定，
 * 已渲染（data-processed）的图表需先从 data-mermaid-source 还原源码再重绘，
 * 使配色立即跟随新主题。
 */
export async function rerenderMermaidDiagrams() {
  if (!mermaidEnabled) return
  document.querySelectorAll<HTMLElement>('.mermaid[data-mermaid-source]').forEach((el) => {
    if (!el.dataset.processed) return
    const source = el.getAttribute('data-mermaid-source') || ''
    el.removeAttribute('data-processed')
    el.textContent = source
  })
  await renderMermaidDiagrams()
}
