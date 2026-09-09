# 性能优化说明

## 范围

MarkCraft 现在使用一个小型 Rust/WASM 模块解析远程目录列表。它只解析现有的 `addRow(...)` 记录，不接触 DOM，也不改变 Markdown 渲染器。为保持兼容性，`markdown-it`、Mermaid、KaTeX 和代码高亮链路保持不变。

## 运行时行为

- `src/content/core/wasm_directory.ts` 会动态加载生成的 WASM 模块。
- 加载、初始化或解析失败时，会自动回退到 TypeScript 正则解析器。
- 目录 HTML 缓存 30 秒，并复用并发中的同一个请求 Promise。
- `src/content/wasm/` 和 Rust `target/` 是构建产物，已加入 Git 忽略规则。

## 当前瓶颈

当前更明确的瓶颈是目录发现过程中的网络往返和重复解析。一次典型约 33 KB 的 Markdown 文档在本地合成基准中使用 `markdown-it` 渲染的中位数约为 1.83 ms，P95 约为 2.62 ms，因此目前没有足够证据整体替换 Markdown 渲染器。

本次只把 WASM 用于可独立基准测试的纯解析逻辑。DOM 操作、网络延迟、Mermaid 布局和最终 HTML 渲染不会因为本次接入自动加速。

## 构建与验证

```bash
npm run build:wasm
npm run build
cargo test --manifest-path wasm/markdown_analyzer/Cargo.toml
cargo clippy --manifest-path wasm/markdown_analyzer/Cargo.toml --all-targets -- -D warnings
```

扩展包必须包含 `dist/content/wasm/markdown_analyzer.js`、对应 glue 模块和 `.wasm` 二进制文件。真机测试时应分别验证正常目录列表，以及暂时移除 WASM 产物后的 JS fallback 路径。
