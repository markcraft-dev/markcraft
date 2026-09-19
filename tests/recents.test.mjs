/**
 * R6 unit tests: recents LRU schema (20 docs, order, eviction, tolerance).
 *
 * Locks the contract in src/content/core/recents.ts: A→B→C ordering,
 * LRU eviction on quota overflow, and sanitize tolerance (clearing data
 * must never affect reading). Runs via `npm run test:unit`
 * (tsc + node:test, zero new deps).
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const {
  touchRecentList,
  sanitizeRecentList,
  deriveRecentTitle,
  touchRecent,
  recordReadingSnapshot,
  getRecents,
  resetRecentsForTest,
  RECENTS_MAX
} = await import('./.tmp/recents.js')

const doc = (href, extra = {}) => ({
  key: href,
  href,
  title: href,
  mtime: 1,
  scrollY: 0,
  progress: 0,
  ...extra
})

beforeEach(() => {
  resetRecentsForTest()
})

test('1. RECENTS_MAX is 20', () => {
  assert.equal(RECENTS_MAX, 20)
})

test('2. A→B→C yields C,B,A order', () => {
  let list = []
  list = touchRecentList(list, doc('file:///A.md'))
  list = touchRecentList(list, doc('file:///B.md'))
  list = touchRecentList(list, doc('file:///C.md'))
  assert.deepEqual(list.map((r) => r.href), ['file:///C.md', 'file:///B.md', 'file:///A.md'])
})

test('3. re-touch moves to front without duplicates', () => {
  let list = []
  list = touchRecentList(list, doc('file:///A.md'))
  list = touchRecentList(list, doc('file:///B.md'))
  list = touchRecentList(list, { ...doc('file:///A.md'), mtime: 2 })
  assert.deepEqual(list.map((r) => r.href), ['file:///A.md', 'file:///B.md'])
  assert.equal(list[0].mtime, 2)
})

test('4. quota overflow evicts least-recently-used (22 touches → 20, A/B gone)', () => {
  let list = []
  for (let i = 0; i < 22; i += 1) {
    list = touchRecentList(list, doc(`file:///doc${i}.md`))
  }
  assert.equal(list.length, 20)
  assert.equal(list[0].href, 'file:///doc21.md')
  assert.ok(!list.some((r) => r.href === 'file:///doc0.md'))
  assert.ok(!list.some((r) => r.href === 'file:///doc1.md'))
})

test('5. sanitize tolerates garbage: non-array, bad entries, dupes, clamps', () => {
  assert.deepEqual(sanitizeRecentList(null), [])
  assert.deepEqual(sanitizeRecentList('{}'), [])
  assert.deepEqual(sanitizeRecentList({}), [])
  const clean = sanitizeRecentList([
    null,
    42,
    { href: '' },
    { href: 'file:///a.md', progress: 150, scrollY: -5 },
    { href: 'file:///a.md#section', progress: 10 },
    { key: '', href: 'file:///b.md', title: '', mtime: NaN }
  ])
  // 同一文档不同 hash 归一到同一 key，第二条去重
  assert.equal(clean.length, 2)
  assert.equal(clean[0].href, 'file:///a.md')
  assert.equal(clean[0].progress, 100)
  assert.equal(clean[0].scrollY, 0)
  assert.equal(clean[1].title, 'b.md')
})

test('6. sanitize caps overlong payloads at 20', () => {
  const big = []
  for (let i = 0; i < 30; i += 1) big.push(doc(`file:///x${i}.md`))
  assert.equal(sanitizeRecentList(big).length, 20)
})

test('7. deriveRecentTitle decodes file names with Markdown fallback', () => {
  assert.equal(deriveRecentTitle('file:///docs/%E6%8C%87%E5%8D%97.md'), '指南.md')
  assert.equal(deriveRecentTitle('file:///docs/'), 'Markdown')
  assert.equal(deriveRecentTitle(''), 'Markdown')
})

test('8. touchRecent + recordReadingSnapshot work without browser APIs', () => {
  touchRecent('file:///A.md')
  touchRecent('file:///B.md#section')
  // hash 归一：B 与 B#section 同一 key，不重复
  touchRecent('file:///B.md')
  const recents = getRecents()
  assert.equal(recents.length, 2)
  assert.equal(recents[0].key, recents[0].href.split('#')[0])
  recordReadingSnapshot('file:///A.md')
  assert.equal(getRecents().length, 2)
  // 未记录过的文档快照自动建条目
  recordReadingSnapshot('file:///C.md')
  assert.equal(getRecents().length, 3)
  assert.equal(getRecents()[0].href, 'file:///C.md')
})
