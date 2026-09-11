# WASM Core Architecture

MarkCraft moves its hand-written core algorithms into a Rust crate compiled to
WebAssembly. The JavaScript layer keeps only DOM access, network and browser
APIs; every conversion rule lives in Rust. All exports have behavior-identical
JS fallbacks, so the extension degrades gracefully if the WASM module is
missing or fails to load.

## Module inventory

Rust crate: `wasm/markdown_analyzer` (output: `src/content/wasm/`, loaded from
`chrome.runtime.getURL('content/wasm/markdown_analyzer.js')`).

| Export | Input → Output | Former JS home | Purpose |
|---|---|---|---|
| `parse_directory(source)` | directory HTML → `DirectoryItem[]` | `wasm_directory.ts` regex | Lex `addRow(...)` rows |
| `filter_directory(source)` | directory HTML → filtered `DirectoryItem[]` | `folder.ts` inline filtering | Hidden-file + Markdown-extension whitelist |
| `scan_directory(source, base)` | directory HTML → `{has_markdown, subfolders}` | `folder.ts` `hasMarkdownContent` loop | Per-page scan for recursive descent |
| `ancestor_folder_urls(root, target)` | URLs → `string[]` | `folder.ts` `getAncestorFolderURLs` | Workspace breadcrumb derivation |
| `build_outline(headings, max_level)` | `[{text, level}]` → `{tree, list}` | `outline.ts` | Slug generation (Unicode filter + `encodeURIComponent` + dedupe counters) and outline tree |
| `search_palette(files, headings, query)` | trees → `PaletteItem[]` | `SearchPaletteModal.vue` | Tree flattening, heading mapping, query filtering, 12/16 limits |
| `dom_to_markdown(dom)` | generic DOM snapshot → GFM string | `dom-to-markdown.ts` | All DOM→Markdown serialization rules (KaTeX, Mermaid, alerts, code fences, task lists, tables, …) |
| `doc_stats(raw)` | text → `{words, minutes}` | `RightSidebar.vue` | Whitespace-stripped UTF-16 char count, 400 chars/min reading time |

## Responsibility split (the JS/Rust contract)

1. **JS owns side effects**: `querySelector`/`textContent`/`checked`, fetch via
   the background service worker, clipboard, IndexedDB, file handles.
2. **Rust owns rules**: anything that decides *what the output looks like* —
   parsing, filtering, mapping, statistics, serialization.
3. **Snapshots are generic**: the DOM serializer in `dom-to-markdown.ts`
   captures `{tag, classes, attrs, text, children}` plus the checkbox
   *property* (user toggles are not reflected as attributes). It contains no
   conversion knowledge.
4. **Fallbacks are mandatory**: each core module wraps the WASM call in
   try/catch and falls back to a local implementation kept in the same file
   (`domToMarkdownFallback`, `buildOutlineFallback`, `searchPaletteFallback`,
   `computeDocStatsFallback`, regex `parseDirectoryFallback`, inline fallbacks
   in `folder.ts`). Loading is centralized in `core/wasm_analyzer.ts` and a
   `null` module short-circuits to JS.

## Engineering constraints

- **No `i64` export parameters.** wasm-bindgen maps `i64` to JS `BigInt`, so a
  plain `number` argument throws `Cannot convert 6 to a BigInt`. Use `i32`.
  (`build_outline(headings: JsValue, max_level: i32)`.)
- **serde field names must match the frontend's camelCase.** A mismatch
  silently deserializes to defaults (e.g. `is_folder` vs the frontend's
  `isFolder`). `PaletteFileNode` uses `#[serde(rename = "isFolder")]`, guarded
  by the `deserializes_camel_case_tree_nodes` regression test.
- `serde_json` is a **dev-dependency only** so the release binary stays small.

## Build & verify

```bash
npm run build:wasm        # wasm-pack build --target web --release
npm run build             # wasm + full extension into dist/
cargo test  --manifest-path wasm/markdown_analyzer/Cargo.toml
cargo clippy --manifest-path wasm/markdown_analyzer/Cargo.toml --all-targets -- -D warnings
```

`dist/` must contain `content/wasm/markdown_analyzer.js`, the glue module and
`markdown_analyzer_bg.wasm` (allowed by `web_accessible_resources` in
`public/manifest.json`). When Chrome blocks the WASM fetch for any reason,
verify the fallback path: the extension must behave identically.

## Size note

The crate grew from a single directory parser (~37 KB `.wasm`) to the full
algorithm layer (~150 KB with `wasm-opt`). It loads once per content-script
session via a cached singleton promise and only when first needed.
