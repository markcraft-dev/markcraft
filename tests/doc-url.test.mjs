/**
 * R4 unit tests: parseDocUrl trailing-junk tolerance (8 cases).
 *
 * Zero-dependency: runs on plain `node --test` against doc-url.ts compiled
 * to tests/.tmp via `npm run test:unit` (tsc + node:test, no vitest needed).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

// doc-url.ts only needs window.location.href as the URL base.
globalThis.window = { location: { href: 'file:///docs/guide.md' } }

const { parseDocUrl, stripTrailingJunk } = await import('./.tmp/doc-url.js')

const CLEAN = 'file:///docs/notes.md'

test('1. clean path is untouched (normal path zero-touch)', () => {
  assert.equal(stripTrailingJunk(CLEAN), CLEAN)
  assert.equal(stripTrailingJunk('file:///docs/v1.2/release-notes.md'), 'file:///docs/v1.2/release-notes.md')
})

test('2. ASCII closing paren from chat copy is stripped', () => {
  assert.equal(stripTrailingJunk(`${CLEAN})`), CLEAN)
  assert.equal(stripTrailingJunk('(see file:///docs/notes.md))'), '(see file:///docs/notes.md')
})

test('3. CJK closing paren is stripped', () => {
  assert.equal(stripTrailingJunk(`${CLEAN}）`), CLEAN)
})

test('4. CJK full stop is stripped', () => {
  assert.equal(stripTrailingJunk(`${CLEAN}。`), CLEAN)
})

test('5. trailing ASCII dot is stripped', () => {
  assert.equal(stripTrailingJunk(`${CLEAN}.`), CLEAN)
})

test('6. quote / angle-bracket wrapping is stripped', () => {
  assert.equal(stripTrailingJunk(`${CLEAN}>`), CLEAN)
  assert.equal(stripTrailingJunk(`${CLEAN}"`), CLEAN)
})

test('7. ASCII and CJK exclamation marks are stripped', () => {
  assert.equal(stripTrailingJunk(`${CLEAN}!`), CLEAN)
  assert.equal(stripTrailingJunk(`${CLEAN}！`), CLEAN)
})

test('8. parseDocUrl end-to-end: dirty pointer resolves, clean paths and anchors untouched', () => {
  // Dirty query pointer from a chat message resolves to the clean document.
  const dirty = parseDocUrl(`file:///docs/guide.md?mdr-doc=${encodeURIComponent(`${CLEAN}）。`)}`)
  assert.equal(dirty.docHref, CLEAN)

  // Clean query pointer resolves unchanged.
  const clean = parseDocUrl(`file:///docs/guide.md?mdr-doc=${encodeURIComponent(CLEAN)}`)
  assert.equal(clean.docHref, CLEAN)

  // Dirty hash pointer resolves too.
  const dirtyHash = parseDocUrl(`file:///docs/guide.md#mdr-doc=${encodeURIComponent(`${CLEAN})`)}`)
  assert.equal(dirtyHash.docHref, CLEAN)

  // Plain heading anchors are never mistaken for doc pointers.
  const anchor = parseDocUrl('file:///docs/guide.md#some-heading')
  assert.equal(anchor.docHref, null)
  assert.equal(anchor.anchor, '#some-heading')
})
