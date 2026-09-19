# MarkCraft

MarkCraft is a privacy-first Chrome extension for reading, editing, and managing Markdown files directly in the browser.

It provides a polished Markdown reading experience with in-browser WYSIWYG editing, file and folder navigation, syntax highlighting, Mermaid diagrams, KaTeX formulas, themes, search, outlines, and local file saving.

## Highlights

- Read Markdown, MDX, MDC, MKD, and MARKDOWN files in the browser
- Edit documents in place and save them locally with explicit user permission
- Render code blocks, Mermaid diagrams, mathematical formulas, images, tables, and task lists
- Browse local Markdown folders with search and document outlines
- Jump through documents and headings with the ⌘K command palette, outline ScrollSpy, and back-to-top control
- Export a self-contained HTML file, print to PDF, or copy rich text for pasting into blogs and docs
- Customize themes, fonts, content width, and Markdown plugins
- Keep document contents and settings local to the user’s browser and device

## Install

No build tools needed — grab a prebuilt package from [Releases](https://github.com/markcraft-dev/markcraft/releases):

1. Download `markcraft-vX.Y.Z.zip` from the latest release and unzip it.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the unzipped `markcraft` folder.
3. To render local files, click **Details** on the MarkCraft card and enable **Allow access to file URLs** — without this, Chrome blocks the extension on `file://` pages and documents show as raw text.

## Development

```bash
pnpm install
pnpm run build
```

`pnpm run build` first compiles the Rust core-algorithm crate to WASM (`pnpm run build:wasm`, requires [wasm-pack](https://rustwasm.github.io/wasm-pack/)) and then bundles the extension into `dist/`. Load that directory from `chrome://extensions` with Developer mode enabled.

### Optional: zero-dialog saves for local files

`file://` pages have an opaque origin, so Chrome blocks IndexedDB there and File System Access grants cannot persist — saves would re-prompt after every reload. Install the bundled Rust native-messaging host to overwrite the original file directly with no dialogs:

```bash
cd native-host && ./install.sh   # then reload the extension in chrome://extensions
```

## Documentation

- [中文文档](README_zh.md)
- [WASM core architecture](docs/wasm_core.md) / [WASM 核心层架构](docs/wasm_core.zh-CN.md)
- [Codebase analysis (中文)](docs/codebase_analysis.zh-CN.md)
- [Performance notes](docs/performance_optimization.md) / [Performance notes (中文)](docs/performance_optimization.zh-CN.md)
- [Rendering review (中文)](docs/rendering_review.zh-CN.md)
- [Product plan](docs/product-plan.md)

## Privacy

MarkCraft is designed for local-first use. Before publishing, verify the extension’s actual permissions, file access behavior, and privacy policy against the current implementation.

## License

MarkCraft is released under the [MIT License](LICENSE).
