# 性能优化说明

## 范围

MarkCraft 将手写的核心算法集中在 Rust/WASM crate（`wasm/markdown_analyzer`）。crate 现覆盖目录列表解析与过滤、大纲 slug 与树构建、快捷搜索面板逻辑、文档统计，以及 DOM→Markdown 的全部序列化规则。DOM 读取、网络请求与浏览器 API 保留在 JavaScript 层。为保持兼容性，`markdown-it`、Mermaid、KaTeX 和代码高亮链路保持不变（JS/Rust 职责契约见 `docs/wasm_core.zh-CN.md`）。

## 运行时行为

- `src/content/core/wasm_analyzer.ts` 是唯一加载器：动态 import 生成的 WASM 模块并缓存初始化 Promise。
- 每个调用方（dom-to-markdown、outline、folder、palette、doc-stats）在加载、初始化或调用失败时回退到本地 JS 实现；回退路径的行为必须一致。
- 目录 HTML 请求缓存 30 秒，并复用并发中的同一个请求 Promise。
- `src/content/wasm/` 和 Rust `target/` 是构建产物，已加入 Git 忽略规则。

## 当前瓶颈

当前更明确的瓶颈是目录发现过程中的网络往返；解析已由 WASM 承担。一次典型约 33 KB 的 Markdown 文档在本地合成基准中使用 `markdown-it` 渲染的中位数约为 1.83 ms，P95 约为 2.62 ms，因此 Markdown 渲染管线保留在 JS。Mermaid 布局、网络延迟和最终 HTML 渲染仍是瓶颈，不在本次 WASM 化范围内。

## 构建与验证

```bash
npm run build:wasm
npm run build
cargo test --manifest-path wasm/markdown_analyzer/Cargo.toml
cargo clippy --manifest-path wasm/markdown_analyzer/Cargo.toml --all-targets -- -D warnings
```

扩展包必须包含 `dist/content/wasm/markdown_analyzer.js`、对应 glue 模块和 `.wasm` 二进制文件。真机测试时应分别验证正常的目录列表与文档保存路径，以及暂时移除 WASM 产物后的 JS fallback 路径。
