/**
 * Heading slug rules (R8) — THE single documented source for the JS side.
 *
 * Same-source chain: Rust `wasm/markdown_analyzer/src/slug.rs::slugify` is
 * authoritative; `outline.rs::build_outline` adds the `section` fallback and
 * the used-set dedup; this module mirrors both for the WASM-unavailable
 * fallback path in `outline.ts`, and the unit tests in `tests/slug.test.mjs`
 * lock the parity (15 cases, incl. CJK/emoji/dup suffixes).
 *
 * Rules (GitHub-style):
 * 1. Lowercase the trimmed text (full Unicode lowercase).
 * 2. U+0020 spaces become `-` (other whitespace is dropped in step 3).
 * 3. Drop every char outside Letters/Marks/decimal digits/number-letters/
 *    connector punctuation/`-`/space — i.e. strip punctuation such as
 *    `, . ! ? % ( )`, and emoji.
 *    (Rust approximates the Unicode classes with `is_alphabetic` /
 *    `is_numeric`; exotic connector punctuation beyond `_` may differ —
 *    known, negligible, covered by tests using common text.)
 * 4. Trim leading/trailing `-` (spaces-turned-hyphens at the edges go away,
 *    but runs in the middle are kept: "a  b" → "a--b").
 * 5. Percent-encode like `encodeURIComponent` (uppercase `%XX`); CJK becomes
 *    `%E4%B8%AD…`, so DOM ids and `#slug` hrefs stay ASCII-safe.
 * 6. Empty base (pure-symbol headings like "!!!") falls back to `section`.
 * 7. Dedup within one document in order: first wins the base, later ones get
 *    `-1`, `-2`, … scanning the used set (so `a, a, a-1` → `a, a-1, a-1-1`,
 *    never a collision).
 *
 * Stability: the mapping is a pure function of the document-ordered heading
 * list, so re-renders (settings change, Mermaid re-render, RAW toggle back)
 * always assign identical ids — shared `#slug` links stay valid.
 */

const INVALID_CHARS = /[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc}\- ]/gu

/** Step 1–5: base slug for one heading text (no uniqueness handling). */
export function slugifyHeadingText(text: string): string {
  const slugified = encodeURIComponent(
    text
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(INVALID_CHARS, '')
      .replace(/^[-]+|[-]+$/g, '')
  )
  return slugified
}

/**
 * Step 6–7: assign document-ordered unique slugs for a list of heading
 * texts (already trimmed). Pure & stable: same input → same output.
 */
export function assignHeadingSlugs(texts: string[]): string[] {
  const used = new Set<string>()
  return texts.map((raw) => {
    const text = (raw || '').trim()
    const base = slugifyHeadingText(text) || 'section'
    if (!used.has(base)) {
      used.add(base)
      return base
    }
    // Scan upward from -1 against the used set (base-collision safe).
    let n = 1
    while (used.has(`${base}-${n}`)) n += 1
    const slug = `${base}-${n}`
    used.add(slug)
    return slug
  })
}
