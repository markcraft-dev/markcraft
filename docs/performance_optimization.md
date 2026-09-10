# Performance Optimization

## Scope

MarkCraft keeps its hand-written core algorithms in a Rust/WASM crate
(`wasm/markdown_analyzer`). The crate now covers directory-listing parsing and
filtering, outline slug/tree building, quick-search palette logic, document
statistics, and the full DOM-to-Markdown serialization rules. DOM access,
network requests, and browser APIs stay in JavaScript. `markdown-it`,
Mermaid, KaTeX, and syntax highlighting remain unchanged for compatibility
(see `docs/wasm_core.md` for the full JS/Rust contract).

## Runtime behavior

- `src/content/core/wasm_analyzer.ts` is the single loader: it dynamically
  imports the generated WASM module and caches the init promise.
- Every consumer (dom-to-markdown, outline, folder, palette, doc-stats)
  falls back to a local JavaScript implementation when loading, init, or a
  call fails; behavior must stay identical on the fallback path.
- Directory HTML requests are cached for 30 seconds and concurrent requests
  share one in-flight promise.
- Generated files under `src/content/wasm/` and Rust `target/` directories are
  build outputs and are ignored by Git.

## Current bottlenecks

The measured hot path is directory discovery: network round trips dominate;
parsing is now handled in WASM. A typical 33 KB Markdown document rendered by
`markdown-it` had a median of about 1.83 ms and a P95 of about 2.62 ms in the
local synthetic benchmark, so the Markdown render pipeline stays in JS.
Mermaid layout, network latency, and final HTML painting are the remaining
bottlenecks and are not addressed by WASM.

## Build and verification

```bash
npm run build:wasm
npm run build
cargo test --manifest-path wasm/markdown_analyzer/Cargo.toml
cargo clippy --manifest-path wasm/markdown_analyzer/Cargo.toml --all-targets -- -D warnings
```

The extension package must contain `dist/content/wasm/markdown_analyzer.js`,
its glue module, and the `.wasm` binary. Chrome runtime testing should verify
both a normal directory listing / document save and the fallback path with the
generated WASM files unavailable.
