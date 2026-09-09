# MarkCraft

MarkCraft is a privacy-first Chrome extension for reading, editing, and managing Markdown files directly in the browser.

It provides a polished Markdown reading experience with in-browser WYSIWYG editing, file and folder navigation, syntax highlighting, Mermaid diagrams, KaTeX formulas, themes, search, outlines, and local file saving.

## Highlights

- Read Markdown, MDX, MDC, MKD, and MARKDOWN files in the browser
- Edit documents in place and save them locally with explicit user permission
- Render code blocks, Mermaid diagrams, mathematical formulas, images, tables, and task lists
- Browse local Markdown folders with search and document outlines
- Customize themes, fonts, content width, and Markdown plugins
- Keep document contents and settings local to the user’s browser and device

## Development

```bash
npm install
npm run build
```

The production-ready extension is generated in `dist/`. Load that directory from `chrome://extensions` with Developer mode enabled.

## Documentation

- [中文文档](README_zh.md)

## Privacy

MarkCraft is designed for local-first use. Before publishing, verify the extension’s actual permissions, file access behavior, and privacy policy against the current implementation.

## License

MarkCraft is not yet licensed for redistribution. A project license will be added before the first public release.
