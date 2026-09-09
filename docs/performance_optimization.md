# Performance Optimization

## Scope

MarkCraft now uses a small Rust/WASM parser for remote directory listings. It parses the existing `addRow(...)` records without touching the DOM or changing the Markdown renderer. `markdown-it`, Mermaid, KaTeX, and syntax highlighting remain unchanged for compatibility.

## Runtime behavior

- `src/content/core/wasm_directory.ts` dynamically loads the generated WASM module.
- If loading, initialization, or parsing fails, the TypeScript regular-expression parser is used automatically.
- Directory HTML requests are cached for 30 seconds and concurrent requests share one in-flight promise.
- Generated files under `src/content/wasm/` and Rust `target/` directories are build outputs and are ignored by Git.

## Current bottlenecks

The measured hot path is directory discovery: network round trips and repeated directory parsing. A typical 33 KB Markdown document rendered by `markdown-it` had a median of about 1.83 ms and a P95 of about 2.62 ms in the local synthetic benchmark. This does not justify replacing the Markdown renderer with WASM yet.

WASM is therefore limited to a pure, repeatable parser where it can be benchmarked independently. DOM work, network latency, Mermaid layout, and final HTML rendering are not accelerated by this change.

## Build and verification

```bash
npm run build:wasm
npm run build
cargo test --manifest-path wasm/markdown_analyzer/Cargo.toml
cargo clippy --manifest-path wasm/markdown_analyzer/Cargo.toml --all-targets -- -D warnings
```

The extension package must contain `dist/content/wasm/markdown_analyzer.js`, its glue module, and the `.wasm` binary. Chrome runtime testing should verify both a normal directory listing and the fallback path with the generated WASM files unavailable.
