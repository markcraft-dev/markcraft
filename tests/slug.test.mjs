/**
 * R8 unit tests: heading slug rules + WASM-parity dedup (15 cases).
 *
 * Locks the contract documented in src/content/core/slug.ts against the
 * Rust source (wasm/markdown_analyzer/src/slug.rs + outline.rs): expected
 * values below mirror the Rust unit tests where they overlap.
 * Runs via `npm run test:unit` (tsc + node:test, zero new deps).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { slugifyHeadingText, assignHeadingSlugs } = await import('./.tmp/slug.js')

test('1. ascii lowercases and spaces become hyphens', () => {
  assert.equal(slugifyHeadingText('Hello World'), 'hello-world')
})

test('2. punctuation is stripped (parity: "Hello, World!" -> "hello-world")', () => {
  assert.equal(slugifyHeadingText('Hello, World!'), 'hello-world')
  assert.equal(slugifyHeadingText('50% off?'), '50-off')
})

test('3. CJK is kept then percent-encoded (parity)', () => {
  assert.equal(slugifyHeadingText('中文 标题'), '%E4%B8%AD%E6%96%87-%E6%A0%87%E9%A2%98')
})

test('4. emoji is stripped, remainder slugged', () => {
  assert.equal(slugifyHeadingText('🎉 Party'), 'party')
})

test('5. duplicate headings get -1/-2 suffixes (parity)', () => {
  assert.deepEqual(assignHeadingSlugs(['同一名', '同一名', '同一名']), [
    '%E5%90%8C%E4%B8%80%E5%90%8D',
    '%E5%90%8C%E4%B8%80%E5%90%8D-1',
    '%E5%90%8C%E4%B8%80%E5%90%8D-2'
  ])
})

test('6. base collision never reuses a slug (parity: a,a,a-1)', () => {
  assert.deepEqual(assignHeadingSlugs(['a', 'a', 'a-1']), ['a', 'a-1', 'a-1-1'])
})

test('7. pure-symbol headings fall back to section (parity)', () => {
  assert.deepEqual(assignHeadingSlugs(['!!!', '!!!']), ['section', 'section-1'])
})

test('8. edge hyphens trimmed, inner runs kept (parity)', () => {
  assert.equal(slugifyHeadingText('  Trim  Me  '), 'trim--me')
})

test('9. underscores and digits survive (parity)', () => {
  assert.equal(slugifyHeadingText('type_view v2'), 'type_view-v2')
})

test('10. accented letters are kept then encoded (parity: café)', () => {
  assert.equal(slugifyHeadingText('café'), 'caf%C3%A9')
})

test('11. CJK/digit mix (parity: 第 1 章)', () => {
  assert.equal(slugifyHeadingText('第 1 章'), '%E7%AC%AC-1-%E7%AB%A0')
})

test('12. empty text falls back to section', () => {
  assert.deepEqual(assignHeadingSlugs(['', '   ']), ['section', 'section-1'])
})

test('13. dots are dropped (parity: v1.2 -> v12)', () => {
  assert.equal(slugifyHeadingText('v1.2'), 'v12')
})

test('14. assignment is stable across renders (same input, same output)', () => {
  const texts = ['概述', '概述', 'Install!', '安装指南 🚀', '概述-1']
  assert.deepEqual(assignHeadingSlugs(texts), assignHeadingSlugs(texts))
})

test('15. no cross-call state leak; dedup is case-insensitive', () => {
  assert.deepEqual(assignHeadingSlugs(['x']), ['x'])
  assert.deepEqual(assignHeadingSlugs(['x']), ['x'])
  assert.deepEqual(assignHeadingSlugs(['Hello', 'hello']), ['hello', 'hello-1'])
})
