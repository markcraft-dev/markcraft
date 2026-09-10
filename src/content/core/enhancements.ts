// MarkCraft DOM Enhancements: Code Block Copy & Image Actions
import type { OutlineItem } from '@/shared/types'

export function enhanceContentBlocks(
  container: HTMLElement,
  onOpenImageModal: (src: string, alt: string) => void
) {
  if (!container) return

  // 1. Enhance Pre / Code Blocks
  const preElements = container.querySelectorAll('pre')
  preElements.forEach((pre) => {
    if (pre.parentElement?.classList.contains('mdr-code-wrapper')) {
      return
    }

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
    dots.innerHTML = '<span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span>'
    left.appendChild(dots)

    const langSpan = document.createElement('span')
    langSpan.className = 'mdr-code-lang'
    langSpan.textContent = lang || 'CODE'
    left.appendChild(langSpan)

    header.appendChild(left)

    const copyBtn = document.createElement('button')
    copyBtn.className = 'mdr-code-copy-btn'
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>复制</span>
    `

    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const textToCopy = (codeEl || pre).textContent || ''
      try {
        await navigator.clipboard.writeText(textToCopy)
        copyBtn.classList.add('copied')
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>已复制</span>
        `
        setTimeout(() => {
          copyBtn.classList.remove('copied')
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px;">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>复制</span>
          `
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
  })

  // 2. Enhance Images
  const imgElements = container.querySelectorAll('img')
  imgElements.forEach((img) => {
    if (img.closest('.mdr-image-wrapper') || img.classList.contains('no-enhance')) {
      return
    }

    img.addEventListener('click', () => {
      onOpenImageModal(img.src, img.alt || '')
    })
  })

  // 3. Heading anchor links (GitHub 式悬停锚点，点击复制标题链接)
  //    注意：锚点元素保持空文本，'#' 由 CSS ::before 渲染，
  //    避免污染 heading.textContent（大纲/TOC/搜索的标题来源）
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  headings.forEach((heading) => {
    if (heading.querySelector('.mdr-heading-anchor')) return
    const anchor = document.createElement('a')
    anchor.className = 'mdr-heading-anchor'
    anchor.title = '复制标题链接'
    anchor.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!heading.id) return
      try {
        await navigator.clipboard.writeText(`${location.href.split('#')[0]}#${heading.id}`)
        anchor.classList.add('mdr-anchor-copied')
        setTimeout(() => {
          anchor.classList.remove('mdr-anchor-copied')
        }, 1200)
      } catch {
        // 剪贴板不可用时静默
      }
    })
    heading.prepend(anchor)
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
