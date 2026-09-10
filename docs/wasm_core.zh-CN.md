# WASM 核心层架构

MarkCraft 将手写的核心算法下沉到 Rust crate 并编译为 WebAssembly。
JavaScript 层只保留 DOM 读取、网络与浏览器 API；所有转换规则集中在 Rust。
每个导出函数都有行为一致的 JS 回退：WASM 缺失或加载失败时功能不降级。

## 模块清单

Rust crate：`wasm/markdown_analyzer`（产物输出至 `src/content/wasm/`，
经 `chrome.runtime.getURL('content/wasm/markdown_analyzer.js')` 动态加载）。

| 导出函数 | 输入 → 输出 | 原 JS 位置 | 职责 |
|---|---|---|---|
| `parse_directory(source)` | 目录 HTML → `DirectoryItem[]` | `wasm_directory.ts` 正则 | `addRow(...)` 记录词法解析 |
| `filter_directory(source)` | 目录 HTML → 过滤后 `DirectoryItem[]` | `folder.ts` 内嵌过滤 | 隐藏文件 + Markdown 扩展名白名单 |
| `scan_directory(source, base)` | 目录 HTML → `{has_markdown, subfolders}` | `folder.ts` `hasMarkdownContent` 循环 | 单页扫描（是否含 MD + 待递归子目录） |
| `ancestor_folder_urls(root, target)` | URL → `string[]` | `folder.ts` `getAncestorFolderURLs` | 工作区面包屑祖先目录推导 |
| `build_outline(headings, max_level)` | `[{text, level}]` → `{tree, list}` | `outline.ts` | slug 生成（Unicode 过滤 + `encodeURIComponent` + 重名计数）与大纲树 |
| `search_palette(files, headings, query)` | 文件树/标题 → `PaletteItem[]` | `SearchPaletteModal.vue` | 树扁平化、标题条目映射、查询过滤、12/16 条限额 |
| `dom_to_markdown(dom)` | 通用 DOM 快照 → GFM 字符串 | `dom-to-markdown.ts` | DOM→Markdown 全部序列化规则（KaTeX、Mermaid、Alerts、代码围栏、任务列表、表格转义等） |
| `doc_stats(raw)` | 文本 → `{words, minutes}` | `RightSidebar.vue` | 去空白 UTF-16 字数、400 字/分钟阅读时长 |

## 职责拆分（JS/Rust 契约）

1. **JS 负责副作用**：`querySelector`/`textContent`/`checked`、经
   background Service Worker 的 fetch、剪贴板、IndexedDB、文件句柄。
2. **Rust 负责规则**：一切决定「输出长什么样」的逻辑——解析、过滤、
   映射、统计、序列化。
3. **快照是通用的**：`dom-to-markdown.ts` 的 DOM 序列化只采集
   `{tag, classes, attrs, text, children}`，外加复选框的 *property*
   勾选态（用户切换不会反映到 attribute）。其中不含任何转换知识。
4. **回退是强制的**：每个 core 模块用 try/catch 包裹 WASM 调用，
   并在同一文件内保留等价 JS 实现（`domToMarkdownFallback`、
   `buildOutlineFallback`、`searchPaletteFallback`、
   `computeDocStatsFallback`、正则版 `parseDirectoryFallback`、
   `folder.ts` 内联回退）。加载统一收口在 `core/wasm_analyzer.ts`，
   模块为 null 时直接走 JS。

## 工程约束

- **导出参数禁用 `i64`**。wasm-bindgen 会把 `i64` 映射为 JS `BigInt`，
  传普通 number 会抛 `Cannot convert 6 to a BigInt`。统一用 `i32`
  （`build_outline(headings: JsValue, max_level: i32)`）。
- **serde 字段名必须对齐前端驼峰**。不一致会静默反序列化为默认值
  （如 `is_folder` vs 前端 `isFolder`）。`PaletteFileNode` 使用
  `#[serde(rename = "isFolder")]`，并由
  `deserializes_camel_case_tree_nodes` 回归测试守护。
- `serde_json` 仅作为 **dev-dependency**（服务单测），不进发布二进制。

## 构建与验证

```bash
npm run build:wasm        # wasm-pack build --target web --release
npm run build             # wasm + 完整扩展到 dist/
cargo test  --manifest-path wasm/markdown_analyzer/Cargo.toml
cargo clippy --manifest-path wasm/markdown_analyzer/Cargo.toml --all-targets -- -D warnings
```

`dist/` 必须包含 `content/wasm/markdown_analyzer.js`、glue 模块与
`markdown_analyzer_bg.wasm`（已由 `public/manifest.json` 的
`web_accessible_resources` 放行）。若 Chrome 因任何原因拦截 WASM 加载，
需验证回退路径：扩展行为必须完全一致。

## 体积说明

crate 从单一目录解析器（约 37 KB `.wasm`）扩展为完整算法层
（经 `wasm-opt` 后约 150 KB）。内容脚本会话内通过单例缓存的 Promise
按需加载一次。
