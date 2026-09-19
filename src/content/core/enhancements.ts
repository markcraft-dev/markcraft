// MarkCraft DOM Enhancements: Code Block Copy & Image Actions
import type { OutlineItem } from '@/shared/types'
import { t } from '@/shared/i18n'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * 用 DOM API 构建复制按钮内容（图标 + 文案）。
 * 不使用 innerHTML：内容脚本运行于宿主页 CSP 环境，启用 Trusted Types 的
 * 页面（如 github.com）会直接抛 TypeError 中断后续增强。
 */
function setCopyButtonContent(btn: HTMLButtonElement, state: 'idle' | 'copied') {
  btn.textContent = ''
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', state === 'copied' ? '2.2' : '1.8')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('style', 'width: 13px; height: 13px;')

  if (state === 'copied') {
    const polyline = document.createElementNS(SVG_NS, 'polyline')
    polyline.setAttribute('points', '20 6 9 17 4 12')
    svg.appendChild(polyline)
  } else {
    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('x', '9')
    rect.setAttribute('y', '9')
    rect.setAttribute('width', '13')
    rect.setAttribute('height', '13')
    rect.setAttribute('rx', '2')
    rect.setAttribute('ry', '2')
    svg.appendChild(rect)

    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')
    svg.appendChild(path)
  }

  const label = document.createElement('span')
  label.textContent = state === 'copied' ? t('ui_copied', '已复制') : t('ui_copy', '复制')

  btn.appendChild(svg)
  btn.appendChild(label)
}

export function enhanceContentBlocks(
  container: HTMLElement,
  onOpenImageModal: (src: string, alt: string) => void,
  getSectionUrl?: (slug: string) => string
) {
  if (!container) return

  // 1. Enhance Pre / Code Blocks
  const preElements = container.querySelectorAll('pre')
  preElements.forEach((pre) => {
    if (pre.parentElement?.classList.contains('mdr-code-wrapper')) {
      return
    }

    try {
      const codeEl = pre.querySelector('code')
      let lang = ''
      if (codeEl) {
        const match = codeEl.className.match(/language-([a-zA-Z0-9_-]+)/)
        if (match) {
          lang = match[1].toUpperCase()
        }
      }

      // Create wrapper
      const wrapper = document.createElement('div')
      wrapper.className = 'mdr-code-wrapper'

      // Create header bar
      const header = document.createElement('div')
      header.className = 'mdr-code-header'

      const left = document.createElement('div')
      left.className = 'mdr-code-header-left'

      const dots = document.createElement('div')
      dots.className = 'mdr-code-dots'
      for (const color of ['red', 'yellow', 'green']) {
        const dot = document.createElement('span')
        dot.className = `dot dot-${color}`
        dots.appendChild(dot)
      }
      left.appendChild(dots)

      const langSpan = document.createElement('span')
      langSpan.className = 'mdr-code-lang'
      langSpan.textContent = lang || 'CODE'
      left.appendChild(langSpan)

      header.appendChild(left)

      const copyBtn = document.createElement('button')
      copyBtn.className = 'mdr-code-copy-btn'
      setCopyButtonContent(copyBtn, 'idle')

      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const textToCopy = (codeEl || pre).textContent || ''
        try {
          await navigator.clipboard.writeText(textToCopy)
          copyBtn.classList.add('copied')
          setCopyButtonContent(copyBtn, 'copied')
          setTimeout(() => {
            copyBtn.classList.remove('copied')
            setCopyButtonContent(copyBtn, 'idle')
          }, 2000)
        } catch (err) {
          console.error('Failed to copy code text:', err)
        }
      })

      header.appendChild(copyBtn)

      // Insert wrapper around pre
      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(header)
      wrapper.appendChild(pre)
    } catch (err) {
      // 单个代码块增强失败不阻断其余图片/标题增强
      console.warn('[MarkCraft] Code block enhancement failed:', err)
    }
  })

  // 2. Enhance Images
  const imgElements = container.querySelectorAll('img')
  imgElements.forEach((img) => {
    if (img.closest('.mdr-image-wrapper') || img.classList.contains('no-enhance')) {
      return
    }

    try {
      img.addEventListener('click', () => {
        onOpenImageModal(img.src, img.alt || '')
      })
    } catch (err) {
      console.warn('[MarkCraft] Image enhancement failed:', err)
    }
  })

  // 3. Heading anchor links (GitHub 式悬停锚点，点击复制标题链接)
  //    注意：锚点元素保持空文本，'#' 由 CSS ::before 渲染，
  //    避免污染 heading.textContent（大纲/TOC/搜索的标题来源）
  //    R8: 链接经 doc-url 的 buildSectionUrl 构造（调用方传入当前文档），
  //    避免 hash-route 页面复制出指向错误文档的旧式 location.split('#') 链接
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  headings.forEach((heading) => {
    if (heading.querySelector('.mdr-heading-anchor')) return
    try {
      const anchor = document.createElement('a')
      anchor.className = 'mdr-heading-anchor'
      anchor.title = t('ui_copy_heading_link', '复制标题链接')
      anchor.addEventListener('click', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!heading.id) return
        const link = getSectionUrl
          ? getSectionUrl(heading.id)
          : `${location.href.split('#')[0]}#${heading.id}`
        try {
          await navigator.clipboard.writeText(link)
          anchor.classList.add('mdr-anchor-copied')
          setTimeout(() => {
            anchor.classList.remove('mdr-anchor-copied')
          }, 1200)
        } catch {
          // 剪贴板不可用时静默
        }
      })
      heading.prepend(anchor)
    } catch (err) {
      console.warn('[MarkCraft] Heading anchor enhancement failed:', err)
    }
  })
}

/**
 * [TOC] 占位容器填充：按大纲层级渲染目录（缩进式扁平结构）。
 * 在大纲重建后调用；容器不存在（文档未使用 [TOC]）时为空操作。
 */
export function renderTocContainer(list: OutlineItem[]) {
  const root = document.getElementById('mdr-toc')
  if (!root) return
  root.querySelectorAll('.mdr-toc-item').forEach((n) => n.remove())

  const frag = document.createDocumentFragment()
  for (const item of list) {
    const a = document.createElement('a')
    a.className = 'mdr-toc-item'
    a.href = item.href
    a.textContent = item.content
    a.style.paddingLeft = `${14 + (item.level - 1) * 14}px`
    frag.appendChild(a)
  }
  root.appendChild(frag)
}
