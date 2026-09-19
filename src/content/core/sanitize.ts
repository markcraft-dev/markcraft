/**
 * Lightweight HTML sanitizer (R0 sanitize chain, export share in T9).
 *
 * markdown-it output is rendered via `v-html` and re-serialized into the
 * standalone export, so untrusted markdown (embedded `<script>`, `<img
 * onerror>`, `javascript:` links, CSS `@import` exfiltration) must be
 * neutralized on both paths. This module is dependency-free (zero-dependency
 * philosophy: no DOMPurify) and split into two layers:
 *
 * 1. Pure-string stage (`stripDangerousElements`, `stripCssImports`,
 *    `isSafeUrl`, `escapeHtml`) — no DOM needed, covered by
 *    `scripts/check-export-unit.mjs`.
 * 2. DOM stage (`sanitizeHtml`) — parses the pre-filtered string and scrubs
 *    attributes (`on*`, unsafe URLs, hostile inline styles). Requires a DOM;
 *    when none is available (e.g. node unit run) it returns the string-stage
 *    result so the function stays total. Trusted-Types-enforcing pages are
 *    handled the same way: assignment failure falls back to the string stage.
 *
 * Kept intact by design: Mermaid/KaTeX `<svg>` output (event attributes and
 * unsafe URLs are stripped, structure preserved), task-list checkboxes
 * (`<input>` is NOT blocklisted), heading `id`s (outline anchors / deep links).
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

/** Escape text interpolated into the export template (title, lang). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] || ch)
}

/**
 * Conservative URL allow-check for href/src-style attributes.
 * Allows: relative URLs, `#anchors`, http/https/file/blob, and data: URLs
 * whose mediatype is a raster font/image type. Blocks: `javascript:`,
 * `vbscript:`, `data:text/html`, `data:text/javascript`, scriptable
 * `image/svg+xml`, and any other scheme (ASCII control chars are stripped
 * first so `java\tscript:`-style evasions don't pass).
 */
export function isSafeUrl(value: string): boolean {
  const cleaned = value.replace(/[\x00-\x20]+/g, '').trim()
  if (!cleaned || cleaned.startsWith('#')) return true
  const schemeMatch = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.exec(cleaned)
  if (!schemeMatch) return true // relative URL
  const scheme = schemeMatch[0].toLowerCase()
  if (scheme === 'http:' || scheme === 'https:' || scheme === 'file:' || scheme === 'blob:') return true
  if (scheme === 'data:') {
    const mediatype = cleaned.slice(5, cleaned.indexOf(',') === -1 ? undefined : cleaned.indexOf(','))
    return /^(image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)|font\/(woff2?|ttf|otf)|application\/font-woff2?)$/i.test(
      mediatype.split(';')[0].trim()
    )
  }
  return false
}

/** Remove `@import ...;` statements (external-CSS exfiltration vector). */
export function stripCssImports(css: string): string {
  return css.replace(/@import\b[^;]*;?/gi, '')
}

/** Elements whose whole subtree is dropped (task-list `<input>` NOT included). */
const STRIPPED_PAIRED_TAGS = ['script', 'iframe', 'object', 'embed', 'frame', 'frameset', 'noembed', 'noframes', 'title']
/** Head-only void elements that must not survive in body HTML. */
const STRIPPED_VOID_TAGS = ['link', 'meta', 'base']

/**
 * Pure-string stage: drop comments, dangerous subtrees, and head-only tags.
 * Case-insensitive, attribute- and newline-tolerant.
 */
export function stripDangerousElements(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '')
  for (const tag of STRIPPED_PAIRED_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
    // Unclosed dangerous opener (truncated markdown) — drop the tag itself.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '')
  }
  for (const tag of STRIPPED_VOID_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '')
  }
  return out
}

const URL_ATTRS = new Set(['href', 'src', 'action', 'cite', 'data', 'poster', 'background', 'formaction', 'xlink:href'])
const HOSTILE_STYLE_RE = /expression\s*\(|javascript\s*:|vbscript\s*:|behaviou?r\s*:/i

function scrubElementAttributes(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name)
      continue
    }
    if (URL_ATTRS.has(name)) {
      if (name === 'srcset') {
        // "url [descriptor], ..." — drop the whole attribute on any unsafe part.
        const parts = attr.value.split(',')
        const bad = parts.some((part) => {
          const url = part.trim().split(/\s+/)[0] || ''
          return url !== '' && !isSafeUrl(url)
        })
        if (bad) el.removeAttribute(attr.name)
        continue
      }
      if (!isSafeUrl(attr.value)) el.removeAttribute(attr.name)
      continue
    }
    if (name === 'style' && HOSTILE_STYLE_RE.test(attr.value)) {
      el.removeAttribute(attr.name)
    }
  }
  if (el.tagName.toLowerCase() === 'style' && el.textContent) {
    const cleaned = stripCssImports(el.textContent)
    if (cleaned !== el.textContent) el.textContent = cleaned
  }
}

/**
 * Full sanitize: string stage + DOM attribute scrub. Keeps Mermaid/KaTeX
 * `<svg>` structure (events/unsafe URLs removed), task-list inputs, and ids.
 */
export function sanitizeHtml(html: string): string {
  const pre = stripDangerousElements(html)
  try {
    if (typeof document === 'undefined') return pre
    const tpl = document.createElement('template')
    tpl.innerHTML = pre
    const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT)
    const els: Element[] = []
    let node: Node | null = walker.nextNode()
    while (node) {
      els.push(node as Element)
      node = walker.nextNode()
    }
    for (const el of els) {
      const tag = el.tagName.toLowerCase()
      if (
        tag === 'script' || tag === 'iframe' || tag === 'object' || tag === 'embed' ||
        tag === 'link' || tag === 'meta' || tag === 'base'
      ) {
        el.remove()
        continue
      }
      scrubElementAttributes(el)
    }
    return tpl.innerHTML
  } catch {
    // Trusted-Types-enforcing hosts (or any DOM failure): string stage still applies.
    return pre
  }
}
