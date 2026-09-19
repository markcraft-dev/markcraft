/**
 * MarkCraft Document Export & Rich-Text Clipboard Utility
 */
import katexCss from 'katex/dist/katex.min.css?raw'
import { escapeHtml, sanitizeHtml } from './sanitize'

/**
 * Copy rendered Markdown as inline-styled Rich Text for WeChat Official Accounts, Zhihu, Notion, etc.
 */
export async function copyAsRichText(element: HTMLElement): Promise<boolean> {
  try {
    const clone = element.cloneNode(true) as HTMLElement

    // Remove buttons, tooltips or editor overlays inside clone
    clone.querySelectorAll('.mdr-code-copy-btn, .mdr-image-wrapper button, .outline-scroll-container').forEach((el) => el.remove())

    // Convert code blocks with inline styling for universal compatibility
    clone.querySelectorAll('pre').forEach((pre) => {
      pre.setAttribute('style', 'background-color: #f8fafc; color: #0f172a; padding: 14px; border-radius: 8px; font-family: monospace; font-size: 13px; line-height: 1.6; overflow-x: auto; border: 1px solid #e2e8f0; margin: 16px 0;')
    })

    // Inline table styling
    clone.querySelectorAll('table').forEach((tbl) => {
      tbl.setAttribute('style', 'width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; border: 1px solid #e2e8f0;')
    })
    clone.querySelectorAll('th').forEach((th) => {
      th.setAttribute('style', 'background-color: #f1f5f9; padding: 8px 12px; font-weight: 600; border: 1px solid #cbd5e1; text-align: left;')
    })
    clone.querySelectorAll('td').forEach((td) => {
      td.setAttribute('style', 'padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left;')
    })

    // Inline blockquote styling
    clone.querySelectorAll('blockquote').forEach((bq) => {
      bq.setAttribute('style', 'margin: 16px 0; padding: 10px 16px; border-left: 4px solid #3b82f6; background-color: #f8fafc; color: #475569; border-radius: 0 6px 6px 0;')
    })

    // Inline headers
    clone.querySelectorAll('h1').forEach((h1) => {
      h1.setAttribute('style', 'font-size: 24px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 24px 0 12px 0;')
    })
    clone.querySelectorAll('h2').forEach((h2) => {
      h2.setAttribute('style', 'font-size: 20px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin: 20px 0 10px 0;')
    })
    clone.querySelectorAll('h3').forEach((h3) => {
      h3.setAttribute('style', 'font-size: 16px; font-weight: 600; color: #0f172a; margin: 16px 0 8px 0;')
    })

    const htmlContent = clone.innerHTML
    const plainText = clone.innerText

    const blobHtml = new Blob([htmlContent], { type: 'text/html' })
    const blobText = new Blob([plainText], { type: 'text/plain' })

    const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })]
    await navigator.clipboard.write(data)
    return true
  } catch (err) {
    console.warn('Rich text copy fallback:', err)
    try {
      await navigator.clipboard.writeText(element.innerText)
      return true
    } catch {
      return false
    }
  }
}

// Interactive chrome that must not leak into the exported file.
const EXPORT_CHROME_SELECTORS = [
  '.mdr-code-copy-btn',
  '.mdr-image-wrapper button',
  '.mdr-heading-anchor',
  '.mdr-mermaid-controls',
  '.outline-scroll-container'
].join(',')

// Oversized images stay remote (mirrors the t5 bg-fetch size cap philosophy):
// a single huge Base64 blob would bloat the single file and risk OOM on save.
const MAX_INLINE_IMAGE_BYTES = 16 * 1024 * 1024

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Inline `<img>` sources as data: URLs so the export opens fully offline.
 * Any failure (CORS, file:// restrictions, oversize, network) degrades to
 * keeping the original URL + console warn — export is never blocked (R1-2).
 */
export async function inlineImagesInto(root: HTMLElement, baseHref: string): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || ''
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return
      let absolute = ''
      try {
        absolute = new URL(src, baseHref).href
      } catch {
        console.warn(`[MarkCraft] export: unresolvable image src, keeping URL: ${src}`)
        return
      }
      if (absolute.startsWith('data:') || absolute.startsWith('blob:')) return
      try {
        const res = await fetch(absolute)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (!blob.size) throw new Error('empty body')
        if (blob.size > MAX_INLINE_IMAGE_BYTES) {
          console.warn(
            `[MarkCraft] export: image over ${(MAX_INLINE_IMAGE_BYTES / 1024 / 1024).toFixed(0)}MB stays remote: ${absolute}`
          )
          return
        }
        const dataUrl = await blobToDataUrl(blob)
        if (!dataUrl) throw new Error('dataURL encode failed')
        img.setAttribute('src', dataUrl)
        img.removeAttribute('srcset')
      } catch (err) {
        console.warn(`[MarkCraft] export: image inline failed, keeping URL: ${absolute}`, err)
      }
    })
  )
}

// Print stylesheet for the exported file AND the on-screen reader (R1-3):
// A4-friendly margins, no clipped code blocks/tables, no orphaned headings.
const EXPORT_PRINT_CSS = `
@media print {
  body { background: #fff !important; padding: 0 !important; display: block !important; }
  .container { box-shadow: none !important; border: none !important; border-radius: 0 !important; max-width: none !important; padding: 0 4mm !important; }
  pre, table, blockquote, figure { break-inside: avoid; page-break-inside: avoid; }
  pre { white-space: pre-wrap !important; overflow: visible !important; }
  img, svg { max-width: 100% !important; }
  h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
  @page { margin: 12mm; }
}`

/**
 * Assemble the standalone document. The body ALWAYS passes through the R0
 * sanitize chain; KaTeX CSS is inlined from the installed package (never
 * hand-copied) so formulas render offline. KaTeX *fonts* stay remote by
 * design (size) and fall back to system serif when offline.
 */
export function buildStandaloneHtmlDocument(title: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(title) || 'MarkCraft Document'
  let docLang = 'zh-CN'
  try {
    docLang = document.documentElement.lang || navigator.language || 'zh-CN'
  } catch {
    // Non-DOM runtimes (unit checks): keep the default.
  }
  const safeBody = sanitizeHtml(bodyHtml)
  return `<!DOCTYPE html>
<html lang="${escapeHtml(docLang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    :root {
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: var(--font-sans);
      color: #111827;
      background-color: #fbfbfb;
      line-height: 1.8;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 860px;
      width: 100%;
      background: #ffffff;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border: 1px solid rgba(0,0,0,0.08);
    }
    h1, h2, h3, h4, h5, h6 { color: #111827; font-weight: 600; line-height: 1.35; }
    h1 { font-size: 2em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.4em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.3em; }
    pre { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; overflow-x: auto; font-family: var(--font-mono); font-size: 13px; }
    code { font-family: var(--font-mono); background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre code { background: transparent; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e5e7eb; }
    th, td { padding: 10px 14px; border: 1px solid #e5e7eb; text-align: left; }
    th { background-color: #f9fafb; font-weight: 600; }
    blockquote { margin: 20px 0; padding: 10px 20px; border-left: 4px solid #2563eb; background: #f8fafc; border-radius: 0 8px 8px 0; color: #4b5563; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
  </style>
  <style>
${katexCss}
  </style>${EXPORT_PRINT_CSS}
</head>
<body>
  <div class="container">
    <article class="mdr-content">
      ${safeBody}
    </article>
  </div>
</body>
</html>`
}

function downloadHtmlDocument(title: string, fullHtml: string): void {
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(title || 'document').replace(/[/\\?%*:|"<>]/g, '_')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export rendered document as a standalone single-file HTML with embedded styles.
 * String-based entry (kept for compat): sanitized + KaTeX/print CSS, no image
 * inlining (no DOM to resolve against) — prefer `exportElementAsStandaloneHtml`.
 */
export function exportAsStandaloneHtml(title: string, renderedHtml: string): void {
  downloadHtmlDocument(title, buildStandaloneHtmlDocument(title, renderedHtml))
}

/**
 * Export the LIVE article element: rendered Mermaid SVGs are serialized inline
 * (the `renderedHtml` string only holds the pre-render code fence), images are
 * inlined with graceful fallback, interactive chrome is stripped, and the
 * result passes through the R0 sanitize chain. Returns false on failure.
 */
export async function exportElementAsStandaloneHtml(
  title: string,
  element: HTMLElement,
  baseHref?: string
): Promise<boolean> {
  try {
    const clone = element.cloneNode(true) as HTMLElement
    clone.querySelectorAll(EXPORT_CHROME_SELECTORS).forEach((el) => el.remove())
    clone.removeAttribute('contenteditable')
    let base = baseHref || ''
    if (!base) {
      try {
        base = document.baseURI || window.location.href
      } catch {
        base = window.location.href
      }
    }
    await inlineImagesInto(clone, base)
    downloadHtmlDocument(title, buildStandaloneHtmlDocument(title, clone.innerHTML))
    return true
  } catch (err) {
    console.warn('[MarkCraft] export failed:', err)
    return false
  }
}
