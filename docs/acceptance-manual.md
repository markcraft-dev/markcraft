# Phase-2 Acceptance: mechanical results + [manual] Chrome checklist (T15)

> Scope: `docs/requirements-p1p2.md` R0–R10. T15 adds fixtures/docs only —
> no `src/` changes. Items that need a source change are recorded as OPEN
> follow-ups, not silently marked green.
> Conventions: `[mech]` = executed this turn (evidence below);
> `[manual]` = needs the user's real Chrome (steps below).

## 1. Fixture inventory (`reference/fixtures/`)

| Fixture | Requirement | State |
|---|---|---|
| `xss.md` (V1–V10 + safe controls) | R0-1 | ✅ added T15 |
| `export-mermaid.md` / `export-katex.md` / `export-table-code.md` | R1-1..3 | ✅ T9 (present) |
| `copy-fidelity.md` | R3 | ✅ T10 (present) |
| `viewer-test.md` (tasks + table + inline math + Mermaid + dup headings) | R10 | ✅ added T15 |

## 2. Mechanical results (this turn)

| # | Check | Result |
|---|---|---|
| M1 | `npm run test:unit` (tsc compile of doc-url/sanitize/slug/recents + node --test doc-url/export-sanitize/slug/recents) | ✅ PASS — 37/37, 0 fail (tsc clean) |
| M2 | Sanitizer string-stage vs every `xss.md` hostile vector (throwaway node script, not committed): 6 tag-strips (script/iframe/object/embed/link/meta), 5 URL blocks (incl. case evasion), 7 URL allows (relative/#anchor/http/file/blob/raster-data), `@import` strip with rule kept, title escape | ✅ PASS — ALL PASS |
| M3 | R7 snippet construction is escape-then-mark (`search-index.ts` highlight builder escapes before wrapping `<mark>`) — code walk, no new behavior | ✅ PASS (walk) |
| M4 | Full `pnpm run build` | ⏭️ SKIPPED by design — `scripts/build.mjs` wipes and regenerates tracked `dist/`; rebuild gates were green in T9–T14 and T15 must not dirty `dist/` (working tree already carries teammates' dist deltas, left untouched) |
| M5 | In-DOM assertions (rendered `v-html` after full pipeline, attribute scrubbing, Mermaid/KaTeX SVG intact) | ➡️ `[manual]` — repo has no DOM lib (no jsdom/happy-dom/playwright) and no headless Chrome here; exact selectors/steps in §4 R0 |

## 3. Recorded gaps (OPEN, need `src/` work — explicitly out of T15 scope)

| # | Gap | Evidence | Proposed follow-up |
|---|---|---|---|
| G1 | R0 render chain: `sanitizeHtml` is wired only into export (`export.ts:228`); `App.vue` render path (`v-html`) and R7 snippet HTML have no sanitize wrap | grep: only `export.ts` imports `./sanitize` outside `sanitize.ts` itself | New task: wrap render assignment + snippet builder, re-run this checklist §4 R0 |
| G2 | R7 browser-side 200-file P95 ≤300ms | Deferred by T13 to manual acceptance (per-query ms shown in UI) | §4 R7 `[manual]` below |

## 4. [manual] Chrome checklist (for the user)

Setup: `pnpm install && pnpm run build`, load unpacked `dist/` in
`chrome://extensions` (Developer mode), enable **Allow access to file URLs**
for local-file items. Open fixtures via `file://` drag-drop or folder tree.

### R0 — render sanitize (`reference/fixtures/xss.md`)

- [ ] Open `xss.md`: **no alert popup** for V1–V10.
- [ ] Devtools Network: **zero requests** to `example.invalid` (V2/V6/V7/V8).
- [ ] Devtools Elements: no `<script>`/`<iframe>`/`<object>`/`<embed>`/`<link>`/`<meta>` nodes;
      no `on*` attributes anywhere (`$$('[onclick],[onerror],[onload],[onmouseover]')` → empty);
      no `href` starting with `javascript:`/`vbscript:`/`data:text/html`.
- [ ] Safe controls intact: task-list checkboxes toggle, heading ids present
      (`$$('h1[id],h2[id],h3[id]')` non-empty), Mermaid flowchart rendered as `<svg>`,
      inline math `$E = mc^2$` rendered by KaTeX.
- [ ] Export HTML of `xss.md`: reopen offline — same stripped result, KaTeX/Mermaid intact.

### R1 — export (`export-mermaid.md`, `export-katex.md`, `export-table-code.md`)

- [ ] Export each → disconnect network → reopen: Mermaid SVGs, KaTeX styling,
      tables/code visually identical to screen (DOM: `img[src^="data:"]` covers
      inlined images).
- [ ] Cross-origin image fixture: export completes with console warn, original URL
      kept, no abort.
- [ ] Print preview (A4): extension chrome hidden, `pre`/`table` not clipped.

### R2 — onboarding (fresh Chrome profile)

- [ ] `file://` doc without file-URL toggle: guide card explains why + where to enable;
      online docs unaffected.
- [ ] 60s tour: 4 stations, skippable, finishes <60s, scroll memory untouched.
- [ ] First save without handle grant: native-host nudge with permanent dismiss.

### R3 — rich-text copy (`copy-fidelity.md`)

- [ ] Paste into 微信公众号 / 知乎 / Notion: headings+lists+tables intact,
      code keeps mono block, formulas appear as `$...$` text, Mermaid is a labeled
      placeholder, images carry the re-upload tail note.

### R4 — trailing-junk URLs

- [ ] Paste a doc path wrapped in `)`/`）`/`>`/`"`/`。`/`.` into chat-style copy:
      open succeeds after one strip+retry. (Unit: 8/8 in `test:unit`.)

### R5 — RAW toggle

- [ ] 1MB doc: render↔RAW instant, zero network (watch `fetchDocContent`), same-key
      scroll restored, `Ctrl/Cmd+Shift+M` works, no manifest shortcut conflict.

### R6/R9 — recents + progress

- [ ] Open A→B→C: Side “最近” order C,B,A; resume badges show %; “continue”
      lands ±24px. (Unit: 37/37 incl. LRU/quota.)

### R7 — full-text search (G2)

- [ ] Open a ~200-file local folder, wait for index, search CJK + Latin prefix:
      ranked hits with snippets ≤300ms P95 (read per-query ms in palette),
      title hits outrank body, empty query shows clean empty state.

### R8 — section links (`viewer-test.md`)

- [ ] Hover every heading: anchor icon; “复制章节链接” → open in fresh tab lands on
      section after render (incl. second “Notes”, CJK/emoji headings, post-Mermaid
      re-render). (Unit: slug parity 15/15 in `test:unit`.)

## 5. Sign-off

Mechanical: green (§2 M1–M3). Manual: pending user run of §4.
Known OPEN: G1 (render-chain sanitize), G2 (= R7 timing run).
P2-4/P2-5 stay Phase-3 per requirements doc.
