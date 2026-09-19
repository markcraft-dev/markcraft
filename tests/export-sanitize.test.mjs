/**
 * R1/R0 unit tests: export sanitize chain (title escaping, URL allow-check,
 * @import stripping, dangerous-element stripping, no-DOM fallback).
 *
 * Zero-dependency: runs on plain `node --test` against sanitize.ts compiled
 * to tests/.tmp via `npm run test:unit` (tsc + node:test, no vitest needed).
 * DOM-attribute scrubbing needs a browser DOM and is covered by fixture DOM
 * assertions (T15); here we assert the pure string stage plus the no-DOM
 * fallback path of sanitizeHtml().
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { escapeHtml, isSafeUrl, stripCssImports, stripDangerousElements, sanitizeHtml } =
  await import('./.tmp/sanitize.js')

test('R1-4: title injection is escaped', () => {
  assert.equal(
    escapeHtml('</title><script>alert(1)</script>'),
    '&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;'
  )
  assert.equal(escapeHtml('a&b"c\'d<e>'), 'a&amp;b&quot;c&#39;d&lt;e&gt;')
  assert.equal(escapeHtml('plain'), 'plain')
  assert.equal(escapeHtml(''), '')
})

test('R0: safe URLs pass (relative, anchors, file/blob/remote, raster-font data:)', () => {
  for (const u of [
    'https://example.com/a.png', 'http://x/y', './assets/d.png', '../i.png',
    '#section-1', 'blob:https://x/1', 'file:///a/b.png',
    'data:image/png;base64,iVBOR', 'data:font/woff2;base64,d09G'
  ]) {
    assert.equal(isSafeUrl(u), true, u)
  }
})

test('R0: hostile URLs blocked (javascript/vbscript/text-html/svg-data + case/whitespace evasions)', () => {
  for (const u of [
    'javascript:alert(1)', '  JaVaScRiPt:alert(1)', 'java\tscript:alert(1)',
    'vbscript:msgbox(1)', 'data:text/html,<h1>x</h1>', 'data:text/javascript,alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>'
  ]) {
    assert.equal(isSafeUrl(u), false, u)
  }
})

test('R0: @import statements stripped, other rules kept', () => {
  assert.equal(
    stripCssImports('@import url("https://evil/x.css");.katex{color:red}'),
    '.katex{color:red}'
  )
  assert.equal(
    stripCssImports("@import 'https://evil/x.css' screen;.a{color:#fff}"),
    '.a{color:#fff}'
  )
  assert.equal(stripCssImports('@IMPORT url(https://evil/x.css);.a{}'), '.a{}')
  assert.equal(
    stripCssImports('.katex{font-size:1em}.katex-display{margin:1em 0}'),
    '.katex{font-size:1em}.katex-display{margin:1em 0}'
  )
})

test('R0: dangerous subtrees removed, mermaid svg / task inputs / heading ids kept', () => {
  const evil = '<h1 id="t">Hi</h1><SCRIPT>alert(1)</SCRIPT>' +
    '<p>ok</p><iframe src="https://evil"></iframe>' +
    '<img src="a.png" onerror="alert(1)"><object data="x"></object>' +
    '<embed src="y"><link rel="stylesheet" href="https://evil/x.css">' +
    '<!-- secret --><svg class="mermaid"><rect width="1"/></svg>' +
    '<ul class="contains-task-list"><li><input type="checkbox" checked>done</li></ul>'
  const stripped = stripDangerousElements(evil)
  for (const gone of ['<SCRIPT>', 'alert(1)</SCRIPT>', '<iframe', '<object', '<embed', '<link', '<!--']) {
    assert.equal(stripped.includes(gone), false, `removes ${gone}`)
  }
  for (const kept of ['<h1 id="t">Hi</h1>', '<p>ok</p>', '<svg class="mermaid">',
    'type="checkbox"', '<img src="a.png"']) {
    assert.equal(stripped.includes(kept), true, `keeps ${kept}`)
  }
})

test('R0: sanitizeHtml without DOM falls back to the string stage', () => {
  const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>')
  assert.equal(out.includes('<script'), false)
  assert.equal(out.includes('<p>hi</p>'), true)
})
