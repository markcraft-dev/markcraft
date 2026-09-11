# MarkCraft 修复后验证报告（t6）

- 验证人：verifier（独立于修复执行者）
- 日期：2026-09-12
- 验证对象：t5（扩展层 13 文件）+ t8（Rust/宿主/docs 21 文件）修复后的完整工作树（34 个源码/文档文件，对照 HEAD b72033d6）
- 验证方式：构建与测试命令全量重跑 + 四份审计报告逐条对照 git diff + 修复代码设计级精读（P0 三项）+ P2/P3 抽验 + 回归专项检查

## 一、验证命令结论（全部通过）

| 命令 | 结果 |
| --- | --- |
| `pnpm run build`（wasm-pack + vite 全量） | ✅ exit 0（11.7s，产物已确认嵌入全部修复后 `git restore dist` 还原） |
| `cargo check --all-targets`（wasm/markdown_analyzer） | ✅ exit 0 |
| `cargo check --all-targets`（native-host/markcraft-file-writer） | ✅ exit 0 |
| `cargo test`（wasm） | ✅ 45 passed / 0 failed（含 8 个新增边界测试） |
| `cargo test`（host） | ✅ 7 passed / 0 failed（含新增 `refuses_symlink_target_without_touching_it`） |
| `git diff --check` | ✅ 干净（源码与文档无空白错误；中途一次失败仅因 dist 生成物内的压缩长行，还原 dist 后全树干净） |

dist/ 产物抽检（还原前）：`html:!1`（html:false）、`securityLevel:"strict"`、快照限深 warn 文案、`native-save request rejected` 校验、`dist/manifest.json` permissions `[storage, nativeMessaging]` 均已嵌入，确认构建产物与源码修复一致。

## 二、P0 逐项核对（3/3 通过，均经设计级代码精读）

### t3-F1 XSS —— ✅ 通过（根因消除）
- `markdown.ts:52` `html: false`：源文档原始 HTML 被转义为纯文本，`v-html`（App.vue:62）产物仅含渲染器自生成标记。
- 注入面逐一排查：highlight 钩子全部经 `md.utils.escapeHtml` 或 hljs 输出；`language-${lang}` 仅在 hljs 已注册语言命中时插值（语言名均为安全标识符）；`[TOC]` 占位（tocPlugin）为静态字符串 html_block，无插值；Mermaid `securityLevel: 'strict'`（markdown.ts:114）；linkify 产物经 markdown-it `validateLink` 拦截 `javascript:`。未引入新依赖，符合约束。
- 全仓 sink 复查：其余 `v-html` 仅 SvgIcon（构建期静态 SVG 资源）；`export.ts:47`/`folder.ts:174` 为读取非写入。无残留可执行注入路径。

### t3-F2 文件句柄裸文件名键控 —— ✅ 通过（根因消除）
- App.vue 两处 `storeFileHandle(fileName, …)` 已删除（仅存完整 file:// URL 键）。
- `file-handle-storage.ts` `trySilentSave` 仅按完整 URL 检索，裸文件名兜底分支整体移除，并留有安全约束注释；`trySilentSaveViaDirectory` 的 `create:false` 语义未动。跨目录同名文件不再可能互相命中。

### t3-F3 设置被默认值覆盖 —— ✅ 通过（根因消除）
- `storage.ts` 改 `createStorage()` + 模块级 `sharedStorage` 单例；App/SettingsModal/popup/options 同一 JS 上下文共享同一 settings ref。
- `toggleTheme`（App.vue:402-405）复用同实例解构出的 `saveSettings`，不再出现「默认值 + 局部改动」整体写回。loadSettings 失败回退、normalizeSettings 合并语义未变。

## 三、P1 逐项核对（7/7 通过）

| 编号 | 结论 | 核对证据 |
| --- | --- | --- |
| t3-F4 WASM 未初始化即调用 | ✅ | `wasm_analyzer.ts` loadAnalyzer 内一次性 `await module.default()` 并缓存（失败缓存 null 短路 + console.debug）；`wasm_directory.ts` 冗余 init 已去除 |
| t3-F5 JS 回退往返转换 | ✅ | dom-to-markdown.ts：嵌套列表按标记宽度缩进、任务项按子节点序列化、单元格保行内格式/转义 `\|`/折叠换行/嵌套表格降级、行收集 `:scope > thead/tbody/tfoot > tr`、th/td 单趟、围栏按内容加长（含行内代码 CommonMark 补空格）、`ol` start 生效、快照 512 限深；Rust 侧同规则落地（见 t1-P1-1）；两侧分歧已消除 |
| t3-F6 根 index.html 第三方产物 | ✅ | 重写为项目占位说明页（ChatGPT 桌面端产物全文移除，注明真实构建入口） |
| t1-P1-1 嵌套表格结构损坏 | ✅ | dommd.rs `collect_direct_rows`（:402）限直接结构、单元格单趟直接子级 th/td、嵌套表格降级 `full_text()`；新增测试 `degrades_nested_table_to_plain_text` 通过 |
| t4-F-01 六语言包旧品牌 | ✅ | 8 包 `ext_name` 均为 MarkCraft；统一为 4 键（ext_name/ext_desc/toggle_theme/toggle_side），8 包键集合逐一比对一致；`command_toggle_centered/refresh` 整键删除且全仓无残留引用 |
| t4-F-02 CONTRIBUTING 虚假脚本 | ✅ | 中英两文件均无 `resources:test`，流程为 `pnpm install` → `pnpm run build`（与 package.json/CI 一致） |
| t4-F-03 权限描述失实 | ✅ | codebase_analysis.zh-CN.md:123 改为「permissions 为 storage / nativeMessaging…2 个快捷键命令」，与 t8 后 manifest 事实一致 |

不修/误报处置核对：P0/P1 范围内无「不修」项；t4-F-06 处置对审计建议的修正成立（本机 pnpm 12.3.4 实测，`allowBuilds` 布尔口径；`@swc/core`/esbuild 均置 true，`pnpm run build` 全链路通过）。未发现任何审计误报。

## 四、P2/P3 抽验（抽验 38 条 ≥ 30% 门槛，证据与结论全部相符）

**已修复类（23 条抽验通过）：**
- ext F8（updateMarkdown 渲染序号守卫 + `rerenderMermaidDiagrams`，主题切换/`storage.onChanged` 双触发）、F9（复制按钮/圆点全 `createElement(NS)`，pre/img/heading 独立 try/catch）、F10（t8：manifest 仅 2 命令）、F11（`escapeHtml(title)`）、F12（IndexedDB 懒加载单例 + `onversionchange` 关闭清缓存）、F13（t8：permissions 无 tabs）、F14（SW 校验 `sender.id`/`path === fileUrlToNativePath(sourceUrl)`/file:// 前缀/绝对路径/64M 上限 + native-save 携带 sourceUrl）、F15（可编辑元素焦点守卫，保留扩展内 Cmd+K/Cmd+S）
- wasm P1-1/P2-1（`unique_slug` HashSet + `outline.ts` 镜像一致）、P2-2（`longest_backtick_run`+`fence()`，行内代码补空格）、P2-4（`ensure_trailing_slash` + `folder.ts` 镜像一致）、P2-5（单趟收集）、P3-2（任务项 `children_to_markdown` + `indents_nested_list_items`/`respects_ordered_list_start_attribute` 测试在）、P3-3 部分（行内代码围栏已加长）、P3-10（随 F4）
- host F1（`create_new(true)` O_EXCL + pid/纳秒/尝试序号 + `sync_all`，测试在）、F2（SW 侧绑定方案，与 ext F14 同一实现）、F3（`symlink_metadata` 显式拒绝，unix 测试在）
- docs F-04（ZH 零弹窗章节 + 文档索引）、F-05（pnpm 口径）、F-06（allowBuilds）、F-07/F-08（主题 7 态）、F-09（45 个单测，与实测一致）、F-10（8 语言）、F-11（Markdown 原文下载归位 App.vue）、F-12（.trellis/.agents 已删）、F-13（statistics）、F-15（src/components 路径标注）、F-17（EN 索引补齐）

**未修类（15 条抽验通过，理由均成立）：**
- ext F7（体积/分包结构性重构）、F16（i18n 未接入，`shared/i18n` 实测零引用）、F17-F20、F21（index.ts:69 body 类名实测未改）、F22、F23
- wasm P2-3 部分修复（快照端 512 限深已落地；Rust 显式栈迭代化未做——调用方全部 try/catch 回退且回退自身已限深，链路优雅失败，理由成立）、P3-1（h7 未收口，实测无 `min(6)`）、P3-4（`read_number` 混合符号实测未改）、P3-5、P3-6/7/9
- host F4 部分（`sync_all` 已落地、权限复制未做）、F5（512MB 预分配实测未改）、F6-F11
- docs F-14、F-16；wasm P3-8 文档措辞收敛未做（`docs/wasm_core.md:5` 仍为 behavior-identical，与处置「留后续文档批处理」一致；代码分歧本身已收敛）

## 五、回归专项检查（全部通过）

| 检查项 | 结论 |
| --- | --- |
| 主题系统 7 款 | ✅ toggleTheme 序列 auto/light/sepia/verdant/dark/nordic/dracula 完整；theme.ts/markdown.css 未被修复改动；主题切换与 `storage.onChanged` 均触发 Mermaid 重绘（新增能力，无回归） |
| [TOC] 与标题锚点 | ✅ tocPlugin 静态占位、`renderTocContainer`、锚点点击复制逻辑均未被改动（仅外包 try/catch）；outline slug 写回标题 id 链路未变 |
| 设置即时生效 | ✅ `storage.onChanged` 处理器保留，新增 themeChanged → Mermaid 重绘；applyCustomStyles 调用未变 |
| i18n key 完整 | ✅ 8 语言包键集合两两一致（4 键）；manifest `default_locale: en`、`__MSG_ext_desc__`/`__MSG_command_*__` 引用全部有对应键 |
| WASM 接口约束 | ✅ `build_outline(headings: JsValue, max_level: i32)`（lib.rs:51）；`isFolder` rename、`camelCase`（palette.rs）未动；`.d.ts` 契约未变 |
| JS 镜像与 Rust 一致性 | ✅ outline.ts `generateSlug`（已用集合）↔ Rust `unique_slug`；folder.ts `getAncestorFolderURLs`（尾斜杠归一化）↔ Rust `ensure_trailing_slash`；dom-to-markdown.ts ↔ dommd.rs（围栏/表格/列表/任务项）逐规则比对一致 |
| 静默保存链路 | ✅ native-save.ts（sourceUrl）↔ background/index.ts（校验）↔ main.rs（O_EXCL/符号链接拒绝/原子写）契约闭合，7 个宿主测试通过 |

## 六、过程记录与备注

1. **验证期间的工作树波动**：本次验证会话中（02:37–03:02）工作树经历了一轮外部「回滚 → 重新应用」（t5 范围收窄导致的回滚与 t8 恢复）。本报告结论针对**最终稳定树**（03:05 起源码无变化，34 个文件）。验证过程中的中间快照（/tmp/t6-surviving-diff.patch）与全部验证命令输出已留存备查。
2. **dist/ 为跟踪的构建产物**：验证已完成 `git restore dist` 还原至 HEAD，当前工作树仅含源码/文档修复；发布或提交前需重新 `pnpm run build` 以使 dist 与源码一致。
3. **遗留观察（非阻塞，均有对应未修处置）**：App.vue:150 `currentTheme` 类型仍缺 `verdant|dracula`（即 F22 既有 P3，未属本次范围）；`docs/wasm_core.md`「behavior-identical」措辞收敛随 P3-8 留待文档批处理；宿主 512MB 预分配（F5）维持未修口径。

## 七、总结论

**验证通过。** 全部 3 项 P0、7 项 P1 修复经代码精读确认根因消除（非表象掩盖）；38 条 P2/P3 抽验（约 60 条中的 63%）证据与处置相符；六项回归专项全部通过；构建、cargo check/test、git diff --check 全绿。未发现修复引入的新回归。后续 t7 汇总可以本报告与四份分区报告的处置备注为准。
