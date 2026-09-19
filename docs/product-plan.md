# MarkCraft Product Plan

> Owner: market research (t6) · v1.0 · 2026-09-19
> Status: living document — priorities follow the three known P0 bugs first.

## 1. Positioning

MarkCraft is a **privacy-first, local-first Chrome extension for reading (and lightly editing)
Markdown files directly in the browser**. Its wedge versus the competition:

- Zero-friction reading of `file://` and remote `.md` URLs — no app switch, no upload, no account.
- In-place WYSIWYG edit + save back to the local file (File System Access, plus an optional
  Rust native-messaging host for zero-dialog saves on `file://` opaque origins).
- Rich rendering parity: Mermaid, KaTeX, syntax highlighting, GFM tables/task-lists/alerts.
- Everything stays on-device (only `storage` + `nativeMessaging` permissions).

Non-positioning: MarkCraft is **not** a note-taking PKM (Obsidian/Logseq), **not** a
collaboration doc (Notion), and **not** a full editor (Typora/VS Code). Editing exists to fix
typos and tweak docs where they live — not to author long-form content.

## 2. Competitor matrix

### 2.1 Browser extensions (direct competitors)

| Product | Rendering (Mermaid/KaTeX/HL) | TOC / outline | Theme / custom CSS | Local `file://` | Edit + save back | Search / palette | Standout | Weakness / lesson |
|---|---|---|---|---|---|---|---|---|
| **Markdown Viewer** (simov) — most-installed classic | Yes / Yes / Yes | TOC sidebar | Themes + custom CSS | Yes (needs “allow file URLs”) | No (view only) | No | Huge install base; trusted simplicity; auto-reload option | Stagnant UX; no editing; per-file theme config is confusing — keep settings global-simple |
| **Markdown Preview Plus** (volca) | Yes / KaTeX / Yes | TOC | Per-file themes, external CSS, auto-reload, export HTML | Yes | No | No | Auto-reload + HTML export users love; per-file theming | Per-file config complexity; dated UI — borrow auto-reload + export, skip per-file themes |
| **Markdown Reader** (shawnmuggle) | Yes / Yes / Yes | Fast nav | Browser-theme aware | Yes (drag-drop + `file://`) | No | Quick nav | Clean GitHub-style read; good onboarding for file-access toggle | View-only; thin feature set — onboarding copy for the file-URL toggle is worth copying |
| **MarkView / Markless / md-reader / markdownReader** (long tail) | Partial–Yes | Some | Some | Yes | Rarely | Rarely | Niche experiments (reader modes, CSDN-audience onboarding) | Fragmented quality; many break on `file://` opaque-origin quirks — reliability is a differentiator |
| **MarkCraft (this project)** | Yes / Yes / hljs | RightSidebar outline + ScrollSpy | Themes, fonts, width, plugins, custom CSS | Yes + folder tree | **Yes**: contenteditable → GFM (WASM `dom_to_markdown`), File System Access + native host | ⌘K palette, folder search, doc stats | Only contender with real save-back + WASM core + folder navigation | Must fix the 3 known P0 bugs before feature work earns trust |

### 2.2 Editors & PKM apps (adjacent / borrow ideas, not compete)

| Product | Core strength | Borrowable idea for MarkCraft | Why not compete |
|---|---|---|---|
| **Typora** (one-time purchase, beloved WYSIWYG) | Seamless live-preview editing, themes, outline, export PDF/HTML | Outline + typewriter/focus polish; one-click export (PDF/HTML); theme market | Desktop app, no browser `file://` flow; editing depth out of scope |
| **Obsidian** (local-first PKM, plugins, graph) | Backlinks, graph, command palette, huge plugin ecosystem, per-note memory | ⌘K palette (already have — deepen it), per-document scroll/cursor restore, plugin-style toggles | PKM vault model ≠ browser reader; no browser extension story |
| **Notion** (collab docs + AI) | Slash commands, databases, sharing, AI writing | Slash-command discoverability for the in-place toolbar; rich copy-paste fidelity (we have rich-text copy — verify vs Notion fidelity) | Cloud/account-based, opposite of local-first privacy story |
| **Logseq** (outliner, blocks, journals) | Block refs, journals, PDF annotation | Block-anchored IIdea only: heading anchor links + “copy link to section” | Outliner paradigm; desktop-first |
| **VS Code + MD preview** | Best editing + preview sync, extensions | Scroll-sync between outline and content (ScrollSpy already — harden it) | Heavyweight; not a reading flow |

### 2.3 Sources consulted

- Chrome Web Store listings: Markdown Viewer, Markdown Preview Plus, Markdown Reader, Markdown Chrome.
- Comparisons: `getmarkview.com/blog/best-markdown-viewers`, `mdview.io/s/markdown-viewer-browser-extension`,
  `markdowneditoronline.com/blog/markdown-viewer-chrome-extension`.
- Repos/docs: `volca/markdown-preview`, `shawnmuggle/markdown-reader`, `md-reader.github.io`,
  `LetitiaChan/markdown_viewer_enhanced`.
- Community pain-point threads (EN): r/Markdown, Hacker News markdown tooling threads,
  Chrome File System Access & native-messaging docs.
- Community pain-point threads (CN): 知乎 “浏览器插件 Markdown 设置/file-access”,
  知乎 “六款免费 Markdown 编辑器”, CSDN markdownReader 解析, V2EX/小红书 markdown 阅读讨论.

## 3. User pain-point backlog (evidence-based)

Ranked by frequency × severity across the sources above. IDs are stable for roadmap traceability.

| ID | Pain point | Who feels it | Evidence |
|---|---|---|---|
| U1 | Browser shows raw markdown text for local `.md` files; enabling “Allow access to file URLs” is undiscoverable | Every new user opening `file://` docs | 知乎 setup guides, Markdown Reader onboarding, CWS reviews |
| U2 | Sidebar / outline randomly empty on `file://` open (race between detection, fetch, render) | Local-file readers | MarkCraft known bug; long-tail extensions break the same way |
| U3 | Scroll position lost when switching docs / reloading; no per-document memory | Long-doc readers (README, specs, books) | Reddit/r/Markdown, HN threads; Typora/Obsidian both remember per-note position — MarkCraft known bug |
| U4 | Switching documents doesn't update the URL (back button / share / refresh broken) | Folder-tree navigators | MarkCraft known bug; SPA-router extensions repeat it |
| U5 | Saving back to disk re-prompts every time on `file://` (opaque origin, no persisted grant) | Anyone fixing typos in local docs | Chrome File System Access docs; MarkCraft native-host exists but undiscovered |
| U6 | No auto-reload when the file changes on disk (editor ↔ browser round-trip) | Dev-doc readers (edit in VS Code, read in browser) | Markdown Preview Plus's most-praised feature |
| U7 | No export path: single-file HTML / PDF / print that preserves Mermaid+KaTeX | Sharing with non-markdown users | MPP export HTML; “markdown to PDF broken print” guides everywhere |
| U8 | Large docs jank: Mermaid/KaTeX/highlight block first paint; no progressive render | Readers of big specs/notes | Performance guides; our `docs/performance_optimization.md` |
| U9 | Copy-paste into 微信/知乎/Notion loses formatting or images | CN content operators | Our `export.ts` rich-text copy exists but fidelity unverified vs Notion/微信 |
| U10 | No full-text search across the open folder (only file names / headings) | Folder-tree users | Obsidian/Logseq set the bar; our palette is filename+heading only |
| U11 | Dark-mode / font / width prefs don't follow per-site or per-doc needs; first-run looks “off” | New users judging in 10s | CWS reviews comparing Reader vs Viewer theming |
| U12 | Images with relative paths break on remote render; no lightbox/zoom | Technical doc readers | Our lightbox exists; relative-path resolution still fragile on proxied fetches |

## 4. Roadmap & priorities

### P0 — Correctness trust (ship first, no new features until green)

| Goal | Maps to | Acceptance criteria |
|---|---|---|
| **P0-1 Per-document scroll isolation + memory**: scroll position keyed by document identity (normalized URL), saved debounced + on hide, restored after render settles; switching docs never leaks positions | U3, team bug “滚动条按文档隔离+记忆” | Open doc A → scroll to 60% → open doc B → back to A: A restores ±24px; B has own position; reload restores; ≥20 docs without storage blowup; no `scroll` handler leak (Mermaid re-render safe) |
| **P0-2 `file://` sidebar never randomly empty**: deterministic takeover/render state machine with retry + explicit empty/error states | U2, team bug “file://直开侧栏随机为空” | 50 consecutive cold `file://` opens (cold profile, cache disabled): outline + folder tree render or show explicit error every time; zero silent-empty sidebars; flaky-timing test passes in CI |
| **P0-3 Document-switch URL sync**: every in-extension navigation pushes the real document URL (history API), back/forward works, reload lands on the same doc | U4, team bug “切换文档URL不同步” | Click 5 docs in tree: address bar matches each; back/forward traverse; reload keeps current doc; shared/copied URL opens that doc directly |
| **P0-4 Save-back reliability + discoverability**: File System Access flow + native-host path both covered by tests; first-run hint surfaces the zero-dialog option and the file-URL toggle | U1, U5 | Save works via handle, directory-handle, dialog fallback, and native host (each with failure test); `file://` without the toggle shows a one-click guide instead of raw text |

### P1 — Reading-loop wins (next release after P0)

| Goal | Maps to | Acceptance criteria |
|---|---|---|
| **P1-1 Auto-reload on file change** (opt-in per folder, polling + `Last-Modified`, preserve scroll per P0-1) | U6 | Edit file on disk → viewer refreshes ≤2s, scroll kept; toggle in settings; off by default on remote URLs |
| **P1-2 Export: single-file HTML + print/PDF CSS that keeps Mermaid/KaTeX/code intact** (harden existing `export.ts`) | U7 | Exported HTML renders offline pixel-equivalent for a fixture (Mermaid+KaTeX+table+code); `@media print` hides chrome, no clipped code blocks (tested on 3 fixtures) |
| **P1-3 First-run onboarding**: file-URL toggle guide, native-host nudge, 60-second tour (palette, outline, edit, save) | U1, U5 | Fresh profile: `file://` shows guided card; tour completable <60s; toggle-detection links to `chrome://extensions` |
| **P1-4 Rich-text copy fidelity pass** (微信/知乎/Notion targets, images inlined or with fallback note) | U9 | Fixture doc (headings/table/code/math/image) pastes into target renderers with headings+lists+table intact; documented limits for math |

### P2 — Depth & delight (only after P0+P1)

| Goal | Maps to | Acceptance criteria |
|---|---|---|
| **P2-1 Folder full-text search** (WASM-indexed, debounced, `file://` friendly) | U10 | Search box returns ranked hits across open folder ≤300ms for 200 files; snippet + heading context; no network |
| **P2-2 “Copy link to section” + heading anchors** (GitHub-style `#slug`, stable across re-render) | Logseq/Obsidian borrow | Every heading has hover anchor; copied link scrolls to section on open; slug algorithm documented + tested (ties to WASM `build_outline`) |
| **P2-3 Reading-progress + per-doc memory v2** (progress %, last-read, resume strip) | U3 extended | Folder tree shows resume badges; “continue reading” jumps to last position; data stays in `chrome.storage.local` |
| **P2-4 Large-doc performance pass** (progressive Mermaid/KaTeX, virtualized outline, lazy images) | U8 | 1MB fixture: first paint ≤2s on reference laptop, no UI freeze; budgets recorded in `docs/performance_optimization.md` |
| **P2-5 Theme polish pack** (print theme, CN-font stack, contrast audit for code/KaTeX) | U11 | 3 new themes, WCAG AA contrast for body+code, CN punctuation/font test page passes |

## 5. Non-goals (explicitly out of scope)

1. **No PKM/second-brain**: no backlinks, graph view, backlinks index, daily notes, or block references.
2. **No collaboration**: no accounts, sync, comments, sharing service, or cloud storage.
3. **No full authoring suite**: no vim mode, multi-cursor editing, or plugin marketplace; editing stays
   typo-fix grade (contenteditable → GFM round-trip must stay lossless instead).
4. **No new permissions**: no `<all_urls>` content-script expansion, no clipboard-read, no history scraping;
   `storage` + `nativeMessaging` only. Any proposal needing a permission bump must re-justify privacy.
5. **No remote services**: no analytics, no update phone-home, no server-side rendering — local-first is a feature.
6. **No mobile app / Safari port** in this planning horizon.

## 6. Metrics (how we know it's working)

- P0: flaky-open repro rate → 0; scroll-restore accuracy ±24px on fixtures; URL-sync e2e green.
- Activation: % of installs that render a first `file://` doc within 24h (proxy: onboarding card dismissal with success).
- Retention proxy: repeat opens of same doc with scroll-restore hit (local-only aggregate, no telemetry exfil).
- Zero new CWS 1-star reviews citing the three P0 bugs within 30 days of the fix release.

## 7. Open questions

1. Should auto-reload (P1-1) use polling only, or also watch via native host? (Needs spike on `file://` constraints.)
2. Single-file HTML export: inline WASM-rendered Mermaid SVG — licensing/size trade-off to verify.
3. CN distribution: Edge Store / offline zip for users without Chrome Web Store access?
