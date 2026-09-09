/**
 * MarkCraft DOM-to-Markdown Serializer
 * Accurately converts contenteditable HTML DOM back into standard GitHub Flavored Markdown (GFM).
 */

export function domToMarkdown(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement

  // Remove UI helper elements injected by MarkCraft (copy buttons, lightbox overlays, etc.)
  clone.querySelectorAll('.mdr-code-copy-btn, .mdr-image-wrapper button, .mdr-in-place-toolbar').forEach((el) => el.remove())

  return nodeToMarkdown(clone).trim() + '\n'
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  // Handle KaTeX formulas
  if (el.classList.contains('katex') || el.classList.contains('katex-display')) {
    const texAnnotation = el.querySelector('annotation[encoding="application/x-tex"]')
    if (texAnnotation && texAnnotation.textContent) {
      const isDisplay = el.classList.contains('katex-display') || el.parentElement?.classList.contains('katex-display')
      return isDisplay ? `\n$$\n${texAnnotation.textContent.trim()}\n$$\n` : `$${texAnnotation.textContent.trim()}$`
    }
  }

  // Handle Mermaid diagrams
  if (el.classList.contains('mermaid') || el.getAttribute('data-mermaid')) {
    const code = el.getAttribute('data-mermaid-source') || el.textContent || ''
    return `\n\`\`\`mermaid\n${code.trim()}\n\`\`\`\n`
  }

  // Handle GitHub Alerts / Callouts
  if (el.classList.contains('markdown-alert')) {
    let alertType = 'NOTE'
    if (el.classList.contains('markdown-alert-tip')) alertType = 'TIP'
    else if (el.classList.contains('markdown-alert-important')) alertType = 'IMPORTANT'
    else if (el.classList.contains('markdown-alert-warning')) alertType = 'WARNING'
    else if (el.classList.contains('markdown-alert-caution')) alertType = 'CAUTION'

    const titleEl = el.querySelector('.markdown-alert-title')
    if (titleEl) titleEl.remove()

    const innerContent = getChildrenMarkdown(el).trim()
    const lines = innerContent.split('\n').map((l) => `> ${l}`).join('\n')
    return `\n> [!${alertType}]\n${lines}\n`
  }

  // Handle Code Blocks
  if (tag === 'pre') {
    const codeEl = el.querySelector('code') || el
    let lang = ''
    codeEl.classList.forEach((cls) => {
      if (cls.startsWith('language-')) lang = cls.replace('language-', '')
    })
    const rawCode = codeEl.textContent || ''
    return `\n\`\`\`${lang}\n${rawCode.replace(/\n+$/, '')}\n\`\`\`\n`
  }

  // Handle Inline Code
  if (tag === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') {
    return `\`${el.textContent || ''}\``
  }

  // Handle Headings
  if (/^h[1-6]$/.test(tag)) {
    const level = parseInt(tag[1], 10)
    const prefix = '#'.repeat(level)
    return `\n${prefix} ${getChildrenMarkdown(el).trim()}\n`
  }

  // Handle Paragraphs & Divs
  if (tag === 'p') {
    return `\n${getChildrenMarkdown(el).trim()}\n`
  }

  if (tag === 'blockquote') {
    const inner = getChildrenMarkdown(el).trim()
    const lines = inner.split('\n').map((l) => `> ${l}`).join('\n')
    return `\n${lines}\n`
  }

  // Handle Strong / Bold
  if (tag === 'strong' || tag === 'b') {
    return `**${getChildrenMarkdown(el)}**`
  }

  // Handle Emphasis / Italic
  if (tag === 'em' || tag === 'i') {
    return `*${getChildrenMarkdown(el)}*`
  }

  // Handle Strikethrough
  if (tag === 'del' || tag === 's' || tag === 'strike') {
    return `~~${getChildrenMarkdown(el)}~~`
  }

  // Handle Links
  if (tag === 'a') {
    const href = el.getAttribute('href') || ''
    const text = getChildrenMarkdown(el)
    return `[${text}](${href})`
  }

  // Handle Images
  if (tag === 'img') {
    const src = el.getAttribute('src') || ''
    const alt = el.getAttribute('alt') || ''
    return `![${alt}](${src})`
  }

  // Handle Lists
  if (tag === 'ul') {
    const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li')
    const md = items.map((li) => {
      const isTask = li.querySelector('input[type="checkbox"]')
      if (isTask) {
        const checked = (isTask as HTMLInputElement).checked
        const taskText = li.textContent?.replace(/^[\s\r\n\t]+/, '') || ''
        return `- [${checked ? 'x' : ' '}] ${taskText.trim()}`
      }
      return `- ${getChildrenMarkdown(li).trim()}`
    }).join('\n')
    return `\n${md}\n`
  }

  if (tag === 'ol') {
    const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li')
    const md = items.map((li, idx) => `${idx + 1}. ${getChildrenMarkdown(li).trim()}`).join('\n')
    return `\n${md}\n`
  }

  // Handle Tables
  if (tag === 'table') {
    return `\n${serializeTable(el)}\n`
  }

  // Handle Horizontal Rule
  if (tag === 'hr') {
    return `\n---\n`
  }

  // Line breaks
  if (tag === 'br') {
    return '\n'
  }

  return getChildrenMarkdown(el)
}

function getChildrenMarkdown(el: Node): string {
  let res = ''
  el.childNodes.forEach((child) => {
    res += nodeToMarkdown(child)
  })
  return res
}

function serializeTable(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  const tableData: string[][] = []
  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('th, td'))
    tableData.push(cells.map((c) => (c.textContent || '').trim().replace(/\|/g, '\\|')))
  })

  if (tableData.length === 0) return ''

  const maxCols = Math.max(...tableData.map((r) => r.length))
  const headerRow = tableData[0]
  while (headerRow.length < maxCols) headerRow.push('')

  const headerLine = `| ${headerRow.join(' | ')} |`
  const separatorLine = `| ${headerRow.map(() => '---').join(' | ')} |`

  const bodyLines = tableData.slice(1).map((row) => {
    while (row.length < maxCols) row.push('')
    return `| ${row.join(' | ')} |`
  })

  return [headerLine, separatorLine, ...bodyLines].join('\n')
}
