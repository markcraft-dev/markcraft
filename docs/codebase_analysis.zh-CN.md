# MarkCraft 代码库全量分析

> 生成于 2026-09-11，对应版本 1.0.0（WASM 核心化改造完成后）。
> 逐文件分析代码职责、依赖关系，以及哪些核心算法已迁移至 Rust/WASM。

---

## 一、项目总体架构

MarkCraft 是一个「本机 Markdown 阅读 / 在线编辑」Chrome 扩展（Manifest V3），
基于 Vue 3 + TypeScript + Vite 构建。注入内容脚本后，把浏览器中打开的
Markdown 文件（`file://` 或远程文本响应）渲染为富文档，并提供：

- 左侧本地文件夹树导航（后台 Service Worker 代理 fetch）
- 右侧文章大纲（ScrollSpy 联动）
- 原地所见即所得编辑（contenteditable），可静默写回本地磁盘
- KaTeX / Mermaid / 代码高亮 / 任务列表 / GitHub Alerts 渲染
- ⌘K 快捷搜索面板、主题 / 字体 / 自定义 CSS 偏好

**核心算法层**已下沉至 Rust/WASM（`wasm/markdown_analyzer`），
JS 层只保留 DOM 读取、网络与浏览器 API 调用，所有失败场景回退 JS 等价实现。
详见 [wasm_core.zh-CN.md](./wasm_core.zh-CN.md)。

```
┌─ content script（index.global.js，IIFE 注入 all pages .md / file:///*）
│   App.vue ── TopHeader / Side(文件树) / RightSidebar(大纲) / 编辑工具
│   core/ ── 渲染入口、WASM 绑定、文件句柄、导出、增强
│   wasm/ ── wasm-pack 产物（markdown_analyzer_bg.wasm 等）
├─ background service worker（bg-fetch 代理 + 快捷键转发）
├─ popup / options（偏好设置 UI）
└─ Rust crate：markdown_analyzer（8 个导出函数，45 个单元测试）
```

---

## 二、src/ 源码逐文件分析

### 内容脚本入口

| 文件 | 职责 | WASM 状态 |
|---|---|---|
| `src/content/index.ts` | 内容脚本入口。判断页面是否为 Markdown（后缀 + Content-Type + `<pre>` 启发式）或本地目录；挂载 Vue 应用到 `#mdr-root`。纯页面准入闸门，运行在 WASM 可用之前，保留 JS。 | 保留 JS（注入时序所限） |
| `src/content/App.vue` | 主应用：状态中枢（主题/侧栏/编辑模式/脏标记），渲染管线 `updateMarkdown`（渲染 → 大纲 → 增强 → Mermaid），保存管线 `saveInPlace`（文件句柄 → 目录句柄静默覆盖 → 首次目录授权 → 单文件对话框兜底）、Markdown 原文下载，全局快捷键、调色盘动作分发。 | `domToMarkdown`/`extractOutline` 改为 await WASM 版 |

### core/（核心逻辑层）

| 文件 | 职责 | WASM 状态 |
|---|---|---|
| `core/markdown.ts` | markdown-it 实例组装：hljs 高亮、KaTeX、emoji、脚注、多线表格、任务列表、Alerts 等插件注册；Mermaid 初始化。纯第三方库胶水，无自有算法。 | 保留 JS（渲染链路为兼容性红线） |
| `core/dom-to-markdown.ts` | **编辑器保存的核心**：contenteditable DOM → GFM。JS 端仅产出通用 DOM 快照（标签/类名/属性/文本/复选框状态），全部转换规则（KaTeX 注解、Mermaid 源码、Alerts、代码块语言、任务列表、表格转义、行内/块级元素映射）在 Rust `dom_to_markdown`。原实现完整保留为回退。 | ✅ 规则层全部 WASM |
| `core/outline.ts` | 大纲提取：JS 采集 `h1~h6` 文本与层级，slug 生成（Unicode 过滤 + encodeURIComponent + 重名计数）、扁平列表与嵌套树在 Rust `build_outline`；JS 把 slug 写回标题 `id` 属性。 | ✅ WASM + 回退 |
| `core/folder.ts` | 文件树：目录 HTML 抓取（经 background 代理、30s 缓存）、条目过滤（隐藏文件/扩展名白名单在 Rust `filter_directory`）、单页扫描 `scan_directory`（是否含 MD + 待递归子目录）、空文件夹剪枝（JS 异步递归）、`mapToTreeNodes` 字段映射、祖先目录推导 `ancestor_folder_urls`。 | ✅ 过滤/扫描/推导 WASM |
| `core/wasm_analyzer.ts` | **统一 WASM 加载器**：动态 import `chrome.runtime.getURL('content/wasm/markdown_analyzer.js')`，单例缓存 Promise，失败返回 null 触发各调用方回退。 | 新增 |
| `core/wasm_directory.ts` | 目录解析第一代绑定：`parse_directory`（addRow 手写词法解析）+ 正则回退。现复用 `wasm_analyzer` 加载器。 | 保留 |
| `core/palette.ts` | ⌘K 面板：文件树扁平化（subPath 拼接）、标题条目映射（`文章大纲 H{n} 章节`）、空查询推荐（前 12）、关键词包含过滤（前 16），全部在 Rust `search_palette`。 | ✅ WASM + 回退 |
| `core/doc-stats.ts` | 字数（去空白、UTF-16 口径对齐 JS `.length`）与阅读时长（400 字/分钟向上取整，最小 1），Rust `doc_stats`。 | ✅ WASM + 回退 |
| `core/enhancements.ts` | DOM 增强：代码块包裹（macOS 圆点 + 语言标签 + 复制按钮）、图片点击灯箱。纯 DOM 操作。 | 保留 JS |
| `core/export.ts` | 富文本复制（微信/知乎内联样式）、单文件 HTML 导出模板。 | 保留 JS |
| `core/file-handle-storage.ts` | IndexedDB 持久化 `FileSystemFileHandle` 与 `FileSystemDirectoryHandle`：文件句柄与目录句柄双路静默保存；目录授权一次后按 URL 前缀最长匹配沿路径下钻覆盖（`create:false` 绝不新建）。注意：`file://` 页面为透明来源，浏览器禁用其 IndexedDB，句柄仅会话内存活——跨会话零弹窗由 `core/native-save.ts`（Native Messaging 宿主）承担。 | 保留 JS（浏览器 API） |
| `core/native-save.ts` | 经 background 中继 `chrome.runtime.connectNative`，把 `{path, content}` 交给 Rust 本机写入宿主（`native-host/`）直接覆盖原文件；宿主缺失时超时回退。 | 保留 JS（浏览器 API） |
| `core/theme.ts` | 主题（auto/light/sepia/verdant/dark/nordic/dracula 共 7 态）与字体/字号/宽度/自定义 CSS 应用。 | 保留 JS |

### components/（内容脚本 UI）

| 文件 | 职责 |
|---|---|
| `components/TopHeader.vue` | 顶栏：侧栏开关、历史导航、面包屑胶囊（文件夹/文件名/编辑状态）、搜索/编辑/全屏/打印/主题/设置按钮、阅读进度条；**编辑模式下内嵌「编辑操作岛」（保存/完成/放弃），操作固定在顶栏、不遮挡正文**。 |
| `components/Side.vue` | 左侧文件树：工作区根记忆（sessionStorage）、展开状态持久化、返回上级、拖拽调宽、点击经 background 加载文件内容（SPA 式切换 + pushState）。 |
| `components/TreeNode.vue` | 树节点递归组件：折叠箭头、文件夹/MD/文件图标、当前文件高亮、新标签页打开。 |
| `components/RightSidebar.vue` | 右侧大纲卡：过滤输入、阅读时长/字数徽标（经 `doc-stats.ts` 走 WASM）、ScrollSpy 高亮、点击跳转、拖拽调宽。 |
| `components/SearchPaletteModal.vue` | ⌘K 命令面板：搜索框 + 文件/章节结果（经 `palette.ts` 走 WASM，带请求序号防竞态）+ 8 个快捷指令 + 键盘导航。 |
| `components/SettingsModal.vue` | 设置弹窗：主题卡、字体/字号、内容宽度、插件开关、自定义 CSS。 |
| `components/InPlaceFormattingToolbar.vue` | 选区浮动格式化工具条（execCommand：加粗/斜体/删除线/H2/H3/P/引用/行内代码/列表/链接）。 |
| `components/ActionBar.vue` | 旧版浮动操作栏（当前 App.vue 未挂载，保留备用）。 |
| `components/About.vue` / `BackToTop.vue` / `ImageLightbox.vue` | 关于弹窗 / 回顶按钮（环形进度）/ 图片灯箱（缩放/下载/Esc）。 |

### shared/、components/ 与其余 UI 面

| 文件 | 职责 |
|---|---|
| `shared/types.ts` | 跨端契约类型：`TreeNodeItem`、`OutlineItem`、`UserSettings`、`AppState`。 |
| `shared/constants.ts` | 插件清单 `DEFAULT_PLUGINS` 与 `DEFAULT_SETTINGS`。 |
| `shared/storage.ts` | `useStorage()`：chrome.storage.local 读写 + `normalizeSettings` 边界归一（mdPlugins 字符串/数组兼容）。 |
| `shared/i18n.ts` | `chrome.i18n.getMessage` 薄封装。 |
| `src/components/CustomSelect.vue` | 自定义下拉（新增未提交文件）。 |
| `src/components/IconButton.vue` / `SvgIcon.vue` / `icons/IconLogo.vue` | 图标按钮、SVG 图标注册与品牌 Logo（与上方 shared/ 不同，均位于 `src/components/`）。 |
| `popup/`（App.vue + main.ts + index.html） | 弹窗：主题七态、字号、KaTeX/Mermaid 开关。 |
| `options/`（App.vue + main.ts + index.html） | 设置页：主题/字体、插件矩阵、自定义 CSS。 |
| `content/styles/markdown.css` | 渲染文档样式。 |
| `content/styles/style.css` | 976KB 预编译聚合样式（历史产物，含 github-markdown-css/katex/hljs/uno）。 |
| `background/index.ts` | Service Worker：`bg-fetch` 跨域代理（绕过 file:// 与 CORS）、`native-save` 中继到本机写入宿主、打开设置页、快捷键命令转发到活动标签页。 |
| `native-host/` | **Rust 本机写入宿主**（Native Messaging，`com.markcraft.filewriter`）：接收 `{path, content}` 覆盖写回原文件；仅绝对路径且目标必须已存在（绝不新建）；`install.sh` 负责构建、按扩展目录计算 ID 并写入 Chrome 宿主清单。 |

---

## 三、Rust WASM crate（核心算法层）

`wasm/markdown_analyzer/`，wasm-pack `--target web` 产出至 `src/content/wasm/`。

| 模块 | 导出函数（`#[wasm_bindgen]`） | 对应原 JS | 单测 |
|---|---|---|---|
| `directory.rs` | `parse_directory` / `filter_directory` / `scan_directory` / `ancestor_folder_urls` | folder.ts 内嵌正则与过滤 | 8 |
| `dommd.rs` | `dom_to_markdown`（DOM 快照 → GFM 全部规则） | dom-to-markdown.ts | 22 |
| `outline.rs` | `build_outline`（slug 去重 + 树） | outline.ts | 5 |
| `slug.rs` | （内部）`slugify` / `encode_uri_component` | generateSlug | 4 |
| `palette.rs` | `search_palette` | SearchPaletteModal 内嵌逻辑 | 4 |
| `stats.rs` | `doc_stats` | RightSidebar 内嵌逻辑 | 2 |

合计 45 个 `cargo test` 单测（以 `cargo test` 实时输出为准），`cargo clippy -D warnings` 干净。
注意两条工程约束（已写入代码注释）：

1. **导出参数禁止 i64**：wasm-bindgen 会把 i64 映射为 BigInt，JS 传 number 直接抛错；统一用 i32。
2. **serde 字段名必须对齐前端驼峰**：如 `PaletteFileNode.is_folder` 需 `#[serde(rename = "isFolder")]`，否则静默反序列化为默认值（已加回归测试守护）。

---

## 四、构建、配置与资源

| 文件 | 职责 |
|---|---|
| `scripts/build.mjs` | Vite 编排：popup/options 两 HTML 入口 → 内容脚本 IIFE（`content/index.global.js`）→ background ESM → 拷贝 manifest/locales/assets/wasm → 内容脚本 ASCII 转义（`\uXXXX`）→ 递归 chmod。watch 模式 200ms 防抖。 |
| `scripts/build_wasm.mjs` | `wasm-pack build --target web --release --out-dir src/content/wasm`。 |
| `public/manifest.json` | MV3：注入 `*.md*` 全协议 + `file:///*`；`web_accessible_resources` 放行 `content/wasm/*`（WASM 动态加载的前提）；permissions 为 storage / nativeMessaging（nativeMessaging 仅用于可选的本机写入宿主，未安装宿主时该能力不生效，保存回退目录授权 + 另存对话框）；2 个快捷键命令。 |
| `public/_locales/*` | en/en_GB/en_US/zh_CN/zh_TW/ja/ko/uk 共 8 语言的描述与命令文案（en 为 default_locale）。 |
| `public/assets/` | Logo、内置字体（NotoSerifSC/GeistMono/Merriweather 等）。 |
| `index.html`（根目录） | 开发用预览页。 |
| `uno.config.ts` / `tsconfig.json` | UnoCSS 原子化配置；TS strict 配置。 |
| `src/content/wasm/.gitignore` | 忽略 wasm-pack 产物。 |

## 五、文档清单

| 文档 | 内容 |
|---|---|
| `README.md` / `README_zh.md` | 项目简介、安装构建、隐私定位。 |
| `docs/performance_optimization.md` / `.zh-CN.md` | WASM 化动机与基准（已更新为多模块架构）。 |
| `docs/wasm_core.md` / `wasm_core.zh-CN.md` | **WASM 核心层架构**：模块清单、JS/Rust 职责契约、数据形状、回退策略、构建与验证。 |
| `docs/codebase_analysis.zh-CN.md` | 本文档。 |
| `CONTRIBUTING*` / `CODE_OF_CONDUCT*` / `SECURITY*` | 社区与安全披露（中英对）。 |

## 六、辅助目录（不影响扩展运行）

- `.codex/`：本地 agent/技能配置（被 .gitignore 忽略，仅存在于部分本地环境）。
- `.github/`：CI（workflows）、ISSUE 模板、FUNDING 等。
- `reference/`：外部参考资料归档（codex-mobile、实验项目、资源归档），非扩展代码（被 .gitignore 忽略）。
- `dist/`：构建产物（已随构建更新，含 `content/wasm/` 完整 WASM 包）。

---

## 七、代码保护边界总结

| 层 | 内容 | 形态 |
|---|---|---|
| **受保护（Rust/WASM）** | DOM→Markdown 全部序列化规则、slug/大纲算法、目录解析与过滤、搜索排序与限额、文档统计 | `.wasm` 二进制 + 薄 glue |
| **半公开（JS 薄壳）** | 通用 DOM 快照采集、WASM 加载与回退、字段搬运（mapToTreeNodes 等） | 可读但无业务规则 |
| **公开（JS）** | 第三方渲染链路（markdown-it/mermaid/katex/hljs）、浏览器 API 胶水、UI 组件 | 无法也不必保护 |

每个 WASM 函数都有行为一致的 JS 回退，WASM 缺失/损坏时功能不降级，
回退实现放在同一模块内便于同步维护。
