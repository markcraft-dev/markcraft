# MarkCraft 扩展层代码复核报告（t3）

- 复核人：ext-reviewer（全量只读复核）
- 日期：2026-09-12
- 范围：`src/content/index.ts`、`src/content/core/*`（13 个模块）、`src/background/index.ts`、`src/popup/main.ts`、`src/options/main.ts`、`src/shared/*`、`index.html`、`public/manifest.json`、`scripts/build.mjs`、`uno.config.ts`；为核实安全结论额外抽查了 `src/content/App.vue`、`src/content/wasm/markdown_analyzer.js`（WASM 胶水）与 `dist/` 产物。
- severity 口径：P0=安全/崩溃/数据损坏；P1=功能错误；P2=健壮性；P3=建议。

## 结论速览

| 等级 | 数量 | 编号 |
| --- | --- | --- |
| P0 | 3 | F1、F2、F3 |
| P1 | 3 | F4、F5、F6 |
| P2 | 9 | F7–F15 |
| P3 | 8 | F16–F23 |

三类必查项明确结论：
1. **XSS / innerHTML / Trusted Types**：**不通过（P0）**。`markdown-it` 以 `html:true` 渲染不可信 Markdown 且经 `v-html` 注入，全程无净化（F1）；另有 Mermaid `securityLevel:'loose'` 放大（F1）、导出 HTML 标题未转义（F11）。现有 `innerHTML` 调用均为静态字符串、无不可信插值，但在启用 Trusted Types 的宿主页（如 github.com）会直接抛错（F9）。
2. **文件句柄与 IndexedDB 生命周期**：**存在 P0**。句柄按「裸文件名」冗余存储与检索，跨目录同名文件会被静默覆盖（F2，数据损坏）。其余方面：句柄失效与权限回收处理正确（`create:false`、`queryPermission/requestPermission` 兜底）；IndexedDB 连接按次打开从不关闭（F12）。
3. **存储竞态**：**存在 P0**。主题切换调用新建的 `useStorage()` 实例，会把 chrome.storage 中的全部用户设置用默认值覆盖（F3，设置数据损坏）。大纲刷新有序号守卫、目录请求有 Promise 缓存去重，这两处竞态处理良好。

---

## P0（安全 / 崩溃 / 数据损坏）

### F1. 不可信 Markdown 未经净化直接 v-html 渲染（XSS）

> **处置（fix-engineer，2026-09-12）：** 已修复 — `markdown.ts` 改 `html: false`（源文档原始 HTML 转义为纯文本，v-html 产物仅含渲染器自生成标记）+ Mermaid `securityLevel: 'strict'`。因「不引入新依赖」约束未引入 DOMPurify；「信任此文档」开关列为后续可选增强。
- 证据：
  - `src/content/core/markdown.ts:49` — `new MarkdownIt({ html: true, ... })`，原始 HTML 全量透传，且不受插件开关控制；
  - `src/content/App.vue:62` — `<article ... v-html="renderedHtml">`；
  - `package.json` 依赖中无 DOMPurify / sanitize-html 等任何净化库；
  - `src/content/core/markdown.ts:106-110` — `mermaid.initialize({ securityLevel: 'loose' })`，关闭 Mermaid 的标签净化。
- 影响：扩展按设计渲染远程站点（`*://*/*.md` 等 text/plain / text/markdown）与本地 file:// 的不可信文档。`v-html` 注入的 HTML 中 `<img onerror>`、`<svg onload>`、`<a href="javascript:">`、`<iframe srcdoc>` 等向量直接在**宿主页 origin** 执行脚本；Mermaid `loose` 模式进一步允许图标签内 HTML。这是典型的存储型/反射型 XSS：恶意 .md 一旦被本扩展接管渲染即可在宿主 origin 运行 JS。
- 建议：
  1. 渲染结果在 `v-html` 前经 DOMPurify 净化（白名单放行 KaTeX/HLJS/Mermaid/任务清单所需标签与 class，`data-mermaid-source` 等属性）；
  2. `securityLevel` 改为 `'strict'`（默认值）；
  3. 评估 `html: false` 或提供「信任此文档」开关，默认安全。

### F2. 文件句柄按裸文件名存取，跨目录同名文件被静默覆盖（数据损坏）

> **处置（fix-engineer，2026-09-12）：** 已修复 — 删除裸文件名维度的存储（App.vue 两处 `storeFileHandle(fileName, …)`）与检索（`trySilentSave` 仅按完整 file:// URL 命中）。
- 证据：
  - `src/content/App.vue:308-309` — 授权后同时 `storeFileHandle(fileUrl, handle)` 与 `storeFileHandle(fileName, handle)`；
  - `src/content/App.vue:336-337` — 「另存为」对话框选中的**任意位置**句柄同样以裸文件名入库；
  - `src/content/core/file-handle-storage.ts:186-199` — `trySilentSave` 先查完整 URL，未命中则 `retrieveFileHandle(fileName)` 用裸文件名兜底；
  - `src/content/core/file-handle-storage.ts:15` — 全局共享 `sessionHandleCache` / IndexedDB 单 store，file:// 页面共用同一 origin，跨目录无隔离。
- 影响：用户在 `/a/README.md` 保存过一次后，编辑 `/b/README.md` 时静默保存会命中 `/a/README.md` 的句柄，**把 A 目录文件内容写成 B 的内容**；「另存为」到别处后同名文件同理。且是零提示的静默覆盖，属数据损坏。
- 建议：删除裸文件名维度的存储与检索（只保留完整 file:// URL 键）；`showSaveFilePicker` 兜底路径严禁写 `fileName` 键；若需「按名匹配」必须校验 `handle` 与目标 URL 的父目录一致（可用目录句柄前缀匹配代替）。

### F3. 主题切换会用默认值覆盖全部用户设置（设置数据损坏）

> **处置（fix-engineer，2026-09-12）：** 已修复 — `useStorage()` 改为模块级单例（同一 JS 上下文内 App/SettingsModal/popup/options 共享同一 settings ref），`toggleTheme` 复用同一实例的 `saveSettings`。
- 证据：
  - `src/content/App.vue:402` — `useStorage().saveSettings({ pageTheme: next })`：这里**新建**了一个 `useStorage()` 实例；
  - `src/shared/storage.ts:31,47-57` — 每次调用 `useStorage()` 都返回全新的 `settings = ref({ ...DEFAULT_SETTINGS })`；`saveSettings` 以 `normalizeSettings({ ...settings.value, ...newVal })` 合并后**整体写回** `chrome.storage.local`；
  - 即写入的是「默认设置 + 新主题」，用户此前在设置页保存的自定义 CSS、字体、字号、内容宽度、插件集合、目录展开层级等全部丢失；随后 `storage.onChanged`（App.vue:509-526）还会把被清空的值同步回本页。
- 建议：`toggleTheme` 改用第 206 行已解构的同一实例（补取 `saveSettings`）；更根本地，把 `useStorage()` 改为模块级单例，杜绝再次出现多实例互相覆盖。

---

## P1（功能错误）

### F4. WASM 核心未初始化即调用导出函数，绝大多数 Rust 算法实际从未生效

> **处置（fix-engineer，2026-09-12）：** 已修复 — `loadAnalyzer()` 内一次性 `await module.default()` 并缓存（失败缓存 null 短路）；`wasm_directory.ts` 去掉冗余 `await wasm.default()`。全部调用方无需各自初始化。
- 证据：
  - `src/content/wasm/markdown_analyzer.js:539` — `let wasmModule, wasmInstance, wasm;`，所有导出（`dom_to_markdown`、`build_outline`、`doc_stats`、`search_palette`、`filter_directory`、`ancestor_folder_urls`）都直接使用模块级 `wasm` 变量，未初始化时为 `undefined`，调用即抛 `TypeError`；
  - 唯一调用 `await wasm.default()` 初始化的是 `src/content/core/wasm_directory.ts:28`（`parseDirectory`）；
  - `src/content/core/dom-to-markdown.ts:60-63`、`outline.ts:79-95`、`palette.ts:59-67`、`doc-stats.ts:17-27`、`folder.ts:80-126` 均直接调用导出函数，`loadAnalyzer()` 只做动态 import、不初始化（`wasm_analyzer.ts:18-28`）。
- 影响：加载顺序决定一切——只有先跑过目录解析的页面（本地目录页）才初始化 WASM；普通 .md 文档页上 DOM→Markdown 往返、大纲 slug、搜索面板、字数统计**永远走 JS 回退**，且全部静默（`catch {}`）。「核心规则位于 Rust」的设计未生效，两条实现路径还可能存在细微行为差异（见 F5）。
- 建议：在 `loadAnalyzer()` 内一次性完成 `await module.default()`（成功后缓存已初始化模块，失败缓存 `null`），调用方不再各自初始化；同时为回退路径加上 `console.debug` 便于诊断。

### F5. JS 回退版 DOM→Markdown 往返转换在嵌套列表/表格/转义上产生错误结果

> **处置（fix-engineer，2026-09-12）：** 已修复（JS 回退侧，`src/content/core/dom-to-markdown.ts`）— 嵌套列表按标记宽度缩进；任务项按子节点序列化（保留行内格式与嵌套）；表格单元格保留行内格式、转义 `|`、换行折叠、嵌套表格降级纯文本、行收集限直接结构（`:scope > thead/tbody/tfoot > tr`）、th/td 单趟按文档序；代码块/行内代码/mermaid 围栏按内容最长反引号串加长；`ol` start 属性生效；快照侧加 512 层深度上限防递归爆栈。**范围说明**：Rust 侧（wasm 报告 P1-1/P2-1/P2-2/P2-4/P2-5）已由 security-reviewer 落地（t8，2026-09-12）——从交接备份恢复 `wasm/markdown_analyzer/src/{dommd.rs,outline.rs,directory.rs}` 并同步 JS 镜像 `outline.ts`/`folder.ts`（slug 已用集合去重、ancestor 尾斜杠归一化），`cargo test` 45 通过，双侧行为分歧已消除。**未修部分**：文本节点 `*`/`_` 等与链接 `]`/`)` 的转义——双侧均未做（见 wasm 报告 P3-3 处置），保持一致缺口待双侧同步修复。
- 证据（`src/content/core/dom-to-markdown.ts`）：
  - `189-207` — `ul/ol` 序列化不缩进子列表：`li` 内嵌套 `ul` 直接拼接，二级及更深列表全部**丢失缩进层级**（`- a\n- b` 语义改变）；任务项分支用 `li.textContent`（195 行），嵌套的列表/加粗/链接被拍平成纯文本；
  - `235-259` — `serializeTable` 用 `textContent` 取单元格：单元格内 **行内格式（粗体/代码/链接）全部丢失**；单元格含 `<br>` 或换行时 `|` 行被折断，产出损坏的 GFM 表格；嵌套表格亦被拍平；
  - 全文 — 文本节点不转义 Markdown 特殊字符（`*`、`_`、`#`、`[` 等），行内代码/围栏代码不做反引号与围栏长度处理（`126-139`），链接文本含 `]`、URL 含 `)` 时产出坏链接（`175-185`）；`ol` 的 `start` 属性被忽略（`203-207`）。
- 影响：原地编辑保存（`saveInPlace`/`export-md`）时文档结构被静默改写，属往返转换功能错误。注意：F4 修复前多数页面恰恰走的就是这份回退实现，实际影响被放大。
- 建议：`ul/ol` 按深度缩进（4 空格/2 空格约定需与 WASM 版对齐）；表格单元格改为 `getChildrenMarkdown(cell).replace(/\n/g, '<br>')` 并转义 `|`；实现文本/链接/代码的转义与围栏加长策略；对齐 Rust 版规则并补往返单测（表格、代码块、嵌套列表、任务清单、数学公式五类各 2-3 例）。

### F6. 仓库根 `index.html` 是无关的第三方（ChatGPT 桌面端）产物

> **处置（fix-engineer，2026-09-12）：** 已修复 — 根 `index.html` 重写为本项目占位说明页（说明真实入口与构建方式）。git 历史核实：该文件自初次提交（671b6e03）即为第三方 ChatGPT 桌面端产物，无更早项目版本可恢复。
- 证据：`index.html:9` — `<title>ChatGPT</title>`；全文为 OpenAI 桌面端启动加载器（blossom logo SVG、`codex-sandbox://` CSP、`app:` 协议、`./assets/index-BOrj4ia4.js` 等），引用的 JS/CSS 在本仓库均不存在。
- 影响：根 `index.html` 原是 Vite 约定的入口位置；现被无关文件占用。当前 `scripts/build.mjs` 用显式 input（popup/options）未受影响，但任何按 Vite 默认约定构建/预览根 index 的流程会产出错误结果；同时第三方代码混入仓库存在合规与混淆风险。
- 建议：恢复/重写为本项目根 HTML（或删除并保持显式 input），核查其来源与提交历史，确认无其他文件同样被污染。

---

## P2（健壮性）

### F7. 内容脚本体积过大：约 5.2MB JS + 1.5MB CSS，document_start 注入每个匹配页面

> **处置（fix-engineer，2026-09-12）：** 不修 — 按需加载/分包属结构性重构，document_start→document_idle 会改变页面接管时序（原文闪烁），均超出本次低风险边界，留后续专项。
- 证据：`dist/content/index.global.js`（5,198,355 字节）、`dist/content/style.css`（1,507,841 字节，含 KaTeX/HLJS/UnoCSS/Vue 全量）；`public/manifest.json:60` `run_at: document_start`；构建未做任何分包（`scripts/build.mjs:98-125` IIFE 单文件）。
- 建议：KaTeX 字体/CSS、HLJS 语言包、Mermaid 按需加载；至少将 `document_start` 改为 `document_idle`（初始化已有 DOMContentLoaded 守卫，index.ts:94-98）。

### F8. 渲染管线 `renderMarkdown` 与 Mermaid 重渲染缺少时序守卫，主题切换后图表配色过期

> **处置（fix-engineer，2026-09-12）：** 已修复 — `updateMarkdown` 加渲染序号守卫（与 `refreshOutline` 同款）；新增 `rerenderMermaidDiagrams()`：主题变更（顶栏切换与 storage.onChanged）时从 `data-mermaid-source` 还原源码并按新主题重绘。
- 证据：`src/content/App.vue:208-219` — `updateMarkdown` 无序号守卫（对比 `refreshOutline` 的 `outlineSeq` 守卫，249-259 行），快速切换文档时 `renderMermaidDiagrams()` 可能在旧 DOM 上执行；`src/content/core/markdown.ts:108` — Mermaid 主题在初始化时按 `data-mdr-theme` 固定，主题切换后已渲染图表不重绘（主题回归点）。
- 建议：为 `updateMarkdown` 加同样的序号守卫；主题变更事件里对 `.mermaid` 重新 `renderMermaidDiagrams()`。

### F9. `innerHTML` 赋值在 Trusted Types 强制页面抛错，代码块增强功能失效

> **处置（fix-engineer，2026-09-12）：** 已修复 — 复制按钮/圆点/已复制态全部改 `createElement(NS)` 构建；每个 pre/img/heading 的增强独立 try/catch，单点失败不再中断后续增强。
- 证据：`src/content/core/enhancements.ts:39,51-57,65-70,73-79` — 复制按钮/红绿灯点均为 `innerHTML` 静态字符串；内容脚本运行于宿主页 CSP 环境下，github.com 等站点 `require-trusted-types-for 'script'` 时赋值抛 `TypeError`，代码块复制按钮不渲染（异常发生在 `enhanceContentBlocks` 内，未被捕获，可能中断后续图片/标题增强）。
- 建议：改用 `createElement`/`cloneNode(template)` 或创建 TrustedTypes policy；将每个 pre/img/heading 的增强放入独立 try/catch。

### F10. manifest 声明的 `toggleCentered`、`toggleRefresh` 快捷键无任何实现

> **处置（fix-engineer，2026-09-12）：** 移交 security-reviewer — 修复位置在 `public/manifest.json` 与 `public/_locales/*`，按队长范围调整（public/** 归属调整）不再由本任务改动。建议方案：移除 `toggleCentered`/`toggleRefresh` 两个 command 并删除 8 个语言包对应 message key（`settings.refresh` 在代码中无任何消费者，无功能可绑定；删除优于无效占位；内容脚本侧 `src/content/App.vue` 本就只处理 toggleSide/togglePageTheme，无需改动）。
>
> **处置（security-reviewer，2026-09-12，t8）：** 已按上述方案完成 — `public/manifest.json` 删除 `toggleCentered`/`toggleRefresh` 两个 command（保留 togglePageTheme/toggleSide）；8 个 `_locales` 语言包删除 `command_toggle_centered`/`command_toggle_refresh` 键（统一为 ext_name/ext_desc/command_toggle_theme/command_toggle_side 4 键），JSON 全部校验通过；全仓 src/scripts 无残留引用。
- 证据：`public/manifest.json:24-41` 注册两个 command；`src/background/index.ts:61-67` 统一转发 `{type:'command'}`；`src/content/App.vue:552-557` 仅处理 `toggleSide` 与 `togglePageTheme`。全仓 grep 无 `toggleCentered`/`toggleRefresh` 处理逻辑。
- 建议：实现或移除这两个 command；空快捷键占位会让用户按了没反应。

### F11. 导出单文件 HTML 时标题未做 HTML 转义

> **处置（fix-engineer，2026-09-12）：** 已修复 — `export.ts` 对 title 做 HTML 转义后插入 `<title>`；正文 `renderedHtml` 随 F1 的 `html:false` 一并安全。
- 证据：`src/content/core/export.ts:76` — `<title>${title || 'MarkCraft Document'}</title>`，`title` 来自 `document.title`（App.vue:455），可含 `</title><script>…` 类内容，注入到导出产物（本地打开的 HTML 文件）。
- 建议：对 title 调用 HTML 转义后再插值；正文 `renderedHtml` 的净化随 F1 一并解决。

### F12. IndexedDB 连接按操作打开且从不关闭

> **处置（fix-engineer，2026-09-12）：** 已修复 — IndexedDB 连接改模块级懒加载单例（Promise 缓存），`onversionchange` 时主动关闭并清空缓存。
- 证据：`src/content/core/file-handle-storage.ts:24-36` — `openDB()` 每次调用 `indexedDB.open`，返回的 `IDBDatabase` 从不 `close()`；`store/retrieve/list` 每次各开一条连接。高频保存/检索时连接堆积，依赖 GC 回收；未来升版本时 `onblocked` 无处理。
- 建议：模块级缓存连接（懒加载单例 + `onversionchange` 时关闭）；或每次用完 `db.close()`。

### F13. `"tabs"` 权限非必需，违反权限最小化

> **处置（fix-engineer，2026-09-12）：** 移交 security-reviewer — 修复位置在 `public/manifest.json`，按队长范围调整不再由本任务改动。建议方案：permissions 收敛为 `['storage','nativeMessaging']`（SW 仅用 `tabId`，无需 tabs 权限）。src 侧配套已完成且不依赖该改动：t3-F14 的 SW 校验改用 `sender.id` + 消息内 `sourceUrl`（`path === fileUrlToNativePath(sourceUrl)`），移除 `tabs` 后依然成立。
>
> **处置（security-reviewer，2026-09-12，t8）：** 已按上述方案完成 — `public/manifest.json` permissions 改为 `["storage", "nativeMessaging"]`。已核实 SW 对 `chrome.tabs` 的唯一用法是 `query({active,currentWindow})` 取 `tabId` 后 `sendMessage`，无需 tabs 权限即可工作；t3-F14 的 native-save 校验基于 `sender.id` + `sourceUrl`，不依赖 tabs。
- 证据：`public/manifest.json:74` — `permissions: ["storage", "tabs", "nativeMessaging"]`；`src/background/index.ts:61-67` 仅使用 `chrome.tabs.query({active:true,currentWindow:true})` 取 `tabId` 后 `sendMessage`——不读 url/title 时无需 `"tabs"` 权限。
- 建议：移除 `"tabs"`；顺便说明 `file:///*` 内容脚本与 `<all_urls>` WAR 是功能所需（本地目录浏览/WASM 加载），但建议在隐私政策中披露。

### F14. background `native-save` 消息不校验路径来源与范围

> **处置（fix-engineer，2026-09-12）：** 已修复 — SW 中继前校验：`sender.id === chrome.runtime.id`、`path === fileUrlToNativePath(sourceUrl)`、`sourceUrl` 须为 file:// 、path 须为绝对路径、内容为字符串且 ≤64M 字符；`native-save.ts` 消息新增 `sourceUrl` 字段（调色板流自然携带其目标 URL，无需豁免）。
- 证据：`src/background/index.ts:22-46` — 直接把 `request.path`、`request.content` 交给原生宿主，无任何校验（scheme、路径白名单、内容大小）。当前唯一调用方 `native-save.ts:8-19` 限 file:// 且非 Windows 路径返回 null，但消息层无纵深防御。
- 建议：SW 侧校验 `path` 必须可由 file:// URL 推导（`file://` 前缀 + 解码后为绝对路径），限制单次内容大小，并对失败做节流日志。

### F15. 全局快捷键劫持宿主页按键，未判断焦点上下文

> **处置（fix-engineer，2026-09-12）：** 已修复 — 焦点在可编辑元素（input/textarea/contentEditable）时跳过快捷键；扩展自身 UI 内保留搜索面板 Cmd+K 与编辑画布 Cmd+S，宿主页输入框完全不受劫持。
- 证据：`src/content/App.vue:475-504` — 在 `window` 上捕获 `Cmd+K/B/U/E/S/,`、`Alt+C/H` 并 `preventDefault`，输入框、网页自带搜索等场景一并被劫持（宿主页功能回归）。
- 建议：当 `e.target` 为可编辑元素（input/textarea/contentEditable）时跳过；或仅在本扩展接管渲染的文档页注册。

---

## P3（建议）

### F16. 运行时 UI 完全未接入 i18n；`shared/i18n.ts` 为死代码

> **处置（fix-engineer，2026-09-12）：** 未修（P3，超出本次范围）。
> **第二轮处置（security-reviewer，2026-09-13）：部分落地（基建 + 内容脚本 UI 全量）** — ① 8 个语言包新增 `ui_toc_title/ui_copy/ui_copied/ui_copy_heading_link/ui_folder_doc_title/ui_folder_doc_body` 6 键（含英/英式/日/韩/乌/简中/繁中翻译）；② `shared/i18n.ts` 的 `t()` 接入全部内容脚本注入 UI：markdown.ts [TOC] 标题、enhancements.ts 复制按钮两态与标题锚点提示、content/index.ts 目录占位文档；③ `export.ts` 导出 HTML 的 `lang` 改为跟随 `document.documentElement.lang || navigator.language`（不再写死 zh-CN）。**残余**：Vue SFC 组件（SettingsModal/TopHeader/RightSidebar 等）约 150 处界面文案仍为中文默认文案，迁移涉及组件模板重构与翻译审校，留专项；处置级别由「未修」改为「部分落地」。

### F17. 本地目录树依赖 SW fetch file://，受「允许访问文件网址」开关制约且无用户提示

> **处置（fix-engineer，2026-09-12）：** 未修（P3，超出本次范围）。
> **第二轮处置（security-reviewer，2026-09-13）：已修复（功能层）** — `folder.ts`：新增 `directoryReadFailed` 状态跟踪与 `hasDirectoryReadFailure()` 导出（空目录与失败状态可区分）；读取失败时一次性 `console.warn` 引导用户开启「允许访问文件网址」；`sendMessage` 增加 try/catch（扩展上下文失效按失败处理而非 unhandledrejection）并吞噬 `lastError`、失败即时清缓存。**残余**：Side 树面板内的可视化错误横幅留专项（状态 API 已就绪）。

### F18. 目录 HTML 请求缓存与错误路径的小问题

> **处置（fix-engineer，2026-09-12）：** 未修（P3，超出本次范围）。
> **第二轮处置（security-reviewer，2026-09-13）：已修复** — executor 内 try/catch 后 `resolve('')`；回调内 `void chrome.runtime.lastError` 吞噬；失败条目即时从 `directoryHtmlCache` 删除（原逻辑已有，配合失败路径保持生效），不再产生 unhandledrejection。

### F19. doc-stats 回退实现把所有语言的字符数当词数

> **处置（fix-engineer，2026-09-12）：** 未修（P3，超出本次范围）。
> **第二轮处置（security-reviewer，2026-09-13）：已修复（双侧同步）** — Rust `stats.rs` 与 JS 回退统一改为「CJK 字符按字计（含中日韩标点/假名/谚文），其余连续非空白串按词计」，阅读时长 400 词/分钟对两类文档均不再系统性偏差；成对新增/更新测试（`counts_cjk_chars_and_latin_words`、`reading_time_is_at_least_one_minute` 扩展英文断言），双侧口径保持逐字一致。

### F20. 大纲 slug 可生成空串与非法 id

> **处置（fix-engineer，2026-09-12）：** 未修（P3，超出本次范围；slug 空串行为 Rust/JS 双侧一致）。
> **第二轮处置（security-reviewer，2026-09-13）：已修复（双侧同步）** — 空 slug 回退固定前缀 `section`（去重器产出 `section`/`section-1`/…），href 与标题 `id` 不再出现空串非法值；Rust `build_outline` + JS `generateSlug` 成对落地，新增测试 `falls_back_to_section_prefix_for_empty_slugs`。

### F21. content/index.ts 接管行为细节

> **处置（fix-engineer，2026-09-12）：** 未修（P3，超出本次范围）。
> **第二轮处置（security-reviewer，2026-09-13）：部分落地（2/3）** — ① 目录误判修复：目录识别增加「页面含 addRow 的 Chrome 本地目录列表」信号，`v1.2` 这类含点目录不再被误判为文件，扩展名复核也只对文件执行；② 多 `<pre>`：正文改为全部 `<pre>` 的 `innerText` 以空行拼接，text/plain 分段内容不再丢失。③ **类名前缀不修（评估结论）**：`mdr` 类名被 `markdown.css` 与构建期压缩的 `style.css` 大面积引用（`body.mdr`、`.mdr` 选择器），改名需源样式与压缩产物双端同步且牵动主题样式，而接管页面本身极少出现同名类冲突（接管条件限定为本地 md/目录与 text/plain），收益低于风险。

### F22. 主题模块缺 prefers-color-scheme 变更监听与类型收窄

> **处置（fix-engineer，2026-09-12）：** 未修（P3，超出本次范围）。
> **第二轮处置（security-reviewer，2026-09-13）：已修复** — ① `theme.ts`：`auto` 时挂 `matchMedia('(prefers-color-scheme: dark)')` 的 change 监听（模块级只挂一次，旧 Safari `addListener` 兼容），系统深浅切换实时重算应用；② `types.ts` 抽出命名类型 `PageTheme` 并在 `UserSettings`/`AppState`/`App.vue` 的 `currentTheme` 统一使用，`verdant|dracula` 不再缺席。

### F23. 构建脚本与 sourcemap

> **处置（fix-engineer，2026-09-12）：** 未修（P3，超出本次范围）。
> **第二轮处置（security-reviewer，2026-09-13）：已修复（校验路线）** — 按建议采用「构建后校验」：build.mjs 新增 `verifyManifestReferences()`，对 manifest 引用的 content_scripts js/css、web_accessible_resources（支持 `*` 通配）、icons、popup/options 页面、service worker、`default_locale` 语言包逐一核对 dist 内存在性，Vite 升级改名当场构建失败而非运行时 404；watch 分支补 `void runBuild().catch(...)`。sourcemap 决策留痕于 build.mjs 注释（不生成：产物体积与源码暴露考量，且 toAscii 后处理会使 map 失效；排查用本地 dev 构建）

---

## 复核中确认良好的方面

- `enhanceContentBlocks` 对已增强元素有幂等守卫（enhancements.ts:13,97,111）；标题锚点用空文本避免污染 `textContent`（106-108 行注释与实现一致）。
- `refreshOutline` 序号守卫、`trySilentSaveViaDirectory` 的 `create:false`（绝不新建）与最长前缀匹配、native-save 的超时与 `lastError` 兜底（native-save.ts:25-45）设计正确。
- `outline.ts:102-104` 把 WASM/JS 统一产出的 slug 按文档顺序写回标题 id，职责边界清晰。
- manifest `_locales` 8 语言 key 完全一致；`content/wasm/*` 已列入 `web_accessible_resources`，动态 import 使用 `chrome.runtime.getURL` 绝对路径，符合 MV3 要求。
- `handlePaletteSelectFile` 失败时回退整页跳转、`history.pushState` 有 try/catch（App.vue:405-420）。

## 建议的修复优先级

1. F1（XSS）与 F3（设置覆盖）改动小、风险高，应最先修；F2 紧随（删除裸文件名键）。
2. F4+F5 一并修（loadAnalyzer 统一初始化 + 回退序列化对齐 Rust 规则），并以往返单测固化。
3. F6 需要与仓库维护者确认根 index.html 来源后恢复。
4. 其余 P2/P3 可在构建闭环验证（由构建复核任务负责 `pnpm build` + dist 一致性）后批量处理。
