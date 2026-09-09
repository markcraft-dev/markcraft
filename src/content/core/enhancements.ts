// MarkCraft DOM Enhancements: Code Block Copy & Image Actions

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

    const langSpan = document.createElement('span')
    langSpan.className = 'mdr-code-lang'
    langSpan.textContent = lang || 'CODE'
    header.appendChild(langSpan)

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
}
