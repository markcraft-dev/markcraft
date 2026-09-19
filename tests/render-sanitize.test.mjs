/**
 * T18/G1 unit tests: R0 sanitize chain on the render path.
 *
 * Each test maps to one vector in `reference/fixtures/xss.md` (see its
 * EXPECTED notes). markdown-it passes block HTML through unchanged, so the
 * pure string stage is asserted directly against the fixture source; the
 * DOM attribute stage (event-handler and unsafe-URL scrubbing) runs in the
 * covered by `docs/acceptance-manual.md` §R0 DOM assertions (T15).
 * The SAFE-CONTROLS section guards against over-stripping (Mermaid/KaTeX
 * structure, task-list inputs, heading ids, data: raster images).
 *
 * Zero-dependency: plain `node --test` via `npm run test:unit`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, '..', 'reference', 'fixtures', 'xss.md'), 'utf8')

const { isSafeUrl, stripCssImports, stripDangerousElements, sanitizeHtml } =
  await import('./.tmp/sanitize.js')

test('G1: fixture vectors reach the sanitizer (fixture/shape drift guard)', () => {
  for (const marker of ['xss-v1', 'xss-v2', 'xss-v3', 'xss-v4a', 'xss-v4b',
    'xss-v5a', 'xss-v5b', 'xss-v9', 'xss-v10a', 'xss-v10b']) {
    assert.ok(fixture.includes(marker), `fixture still contains ${marker}`)
  }
})

test('G1 V1/V6/V7: script, frames, objects, head-only tags dropped from render HTML', () => {
  const out = stripDangerousElements(fixture)
  assert.ok(!out.includes('<script>'), 'V1 script element gone')
  assert.ok(!out.includes("alert('xss-v1')"), 'V1 payload gone with its element')
  assert.ok(!/<iframe\b/i.test(out), 'V6 iframe gone')
  assert.ok(!/<object\b/i.test(out), 'V6 object gone')
  assert.ok(!/<embed\b/i.test(out), 'V6 embed gone')
  assert.ok(!/<link\b/i.test(out), 'V7 link gone')
  assert.ok(!/<meta\b/i.test(out), 'V7 meta gone')
})

test('G1 V3/V4/V5: hostile link schemes blocked (incl. tab-break evasion)', () => {
  // Schemes as they appear post-markdown-it (entity &#9; decoded to a tab).
  for (const u of ["javascript:alert('xss-v3')", "JaVaScRiPt:alert('xss-v4a')",
    'java\tscript:alert(\'xss-v4b\')', 'data:text/html,<script>',
    'vbscript:alert(\'xss-v5b\')']) {
    assert.equal(isSafeUrl(u), false, `blocked: ${JSON.stringify(u)}`)
  }
})

test('G1 V8: @import stripped from the fixture style block', () => {
  const styleBody = fixture.slice(fixture.indexOf('<style>'), fixture.indexOf('</style>'))
  const cleaned = stripCssImports(styleBody)
  assert.ok(!cleaned.toLowerCase().includes('@import'), '@import gone')
  assert.ok(cleaned.includes('.xss-v8'), 'benign rule text retained')
})

test('G1 V2/V9/V10: hostile markup documented inert (handlers are DOM-stage work)', () => {
  // The string stage keeps the elements; the browser DOM stage strips the
  // on* attributes (asserted live in acceptance-manual §R0). Here we pin the
  // contract: elements survive, so only the attribute scrub may remove them.
  const out = stripDangerousElements(fixture)
  assert.ok(out.includes('<img src="https://example.invalid/broken.png"'), 'V2 img element retained')
  assert.ok(out.includes('<svg xmlns='), 'V9 svg structure retained')
  assert.ok(out.includes('<div onclick='), 'V10 div retained pre-DOM-stage')
})

test('G1 SAFE CONTROLS: no over-stripping of reader-critical markup', () => {
  const safe = [
    '<div class="mermaid" data-mermaid-source="flowchart LR">flowchart LR</div>',
    '<span class="katex"><span class="katex-mathml"><math><semantics>' +
    '<annotation encoding="application/x-tex">E = mc^2</annotation></semantics></math></span></span>',
    '<span class="katex-display"><span class="katex">display</span></span>',
    '<li><input type="checkbox" checked>done</li>',
    '<h3 id="safe-heading-keeps-its-id">Safe heading</h3>',
    '<a href="./viewer-test.md">Relative link</a>',
    '<a href="#v1-anchor">same-page anchor</a>',
    '<img src="data:image/png;base64,iVBOR" alt="raster">'
  ].join('\n')
  // String stage must be identity on safe markup.
  assert.equal(stripDangerousElements(safe), safe, 'string stage is identity on safe HTML')
  // Every safe URL stays allowed (kept, inert where remote).
  for (const u of ['./viewer-test.md', '#v1-anchor', 'data:image/png;base64,iVBOR']) {
    assert.equal(isSafeUrl(u), true, `allowed: ${u}`)
  }
})

test('G1: sanitizeHtml entry stays total without a DOM (string stage applies)', () => {
  const out = sanitizeHtml(fixture)
  assert.ok(!out.includes('<script>'), 'no script survives the entry point')
  assert.ok(out.includes('Task-list checkbox must keep working'), 'safe text survives')
})
