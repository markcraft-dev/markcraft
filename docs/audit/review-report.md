# MarkCraft 全量复核总报告

- 汇总人：docs-reviewer（t7，整合与交叉核对）
- 日期：2026-09-12
- 输入：四份分区审计报告（`docs/audit/wasm-core-audit.md`、`native-host-security-audit.md`、`extension-code-audit.md`、`docs-audit.md`，均含处置块）+ 独立验证报告 `docs/audit/verification-report.md`（处置状态的权威来源）
- 方法：不改写事实，只做整合与交叉核对。P0/P1 证据全部对照当前工作树代码独立复核；P2/P3 处置引用验证报告抽验结论与各处置块；统计口径见 §五.3。
- 约束遵守：本报告为本次任务唯一写入文件；未改动 dist/ 与任何其他工作区文件。

---

## 一、执行摘要

**整体健康度：修复后达到可发布前的良好状态。** 项目架构分层清晰（Rust/WASM 核心算法 + JS 回退 + 浏览器 API 薄壳），核心安全设计（宿主绝对路径、只覆盖已存在文件、原子写入、`allowed_origins` 锁定、UTF-8 强制校验；扩展侧渲染管线、保存链路）在审计中获得大量肯定结论。修复前存在三个现实可触发的 P0（XSS、跨目录同名文件静默覆盖、用户设置被默认值覆盖）与七个 P1（含「WASM 核心实际从未生效」这一设计失能级缺陷），**现已全部修复并经独立验证确认根因消除**；P2 修复覆盖 24/26，P3 按低风险口径选择性修复。

**修复前关键风险（均已消除）：**
1. **XSS（t3-F1）**：`markdown-it` 以 `html:true` 渲染不可信 Markdown 并经 `v-html` 注入宿主页 origin，全程无净化，Mermaid `securityLevel:'loose'` 放大——恶意 .md 一旦被接管渲染即可在宿主 origin 执行脚本。
2. **静默数据损坏（t3-F2）**：文件句柄按裸文件名冗余存取，`/a/README.md` 的句柄会命中 `/b/README.md` 的保存，内容零提示互相覆盖。
3. **设置数据损坏（t3-F3）**：主题切换新建 `useStorage()` 实例，把用户全部设置以默认值整体写回。
4. **核心算法失能（t3-F4，P1）**：WASM 模块除目录解析路径外从未初始化，DOM→Markdown 往返、大纲 slug、搜索面板、字数统计在普通文档页永远静默走 JS 回退——「核心规则在 Rust」的设计未生效。
5. **纵深防御缺口（t2-F2，P2）**：SW 中继不绑定 sender/path 时不设防，扩展上下文一旦被攻破即可覆写用户可写的任意既有文件（现已绑定到「当前正在浏览的 file:// 文档」）。

**修复统计（口径详见 §五.3）：**

| 级别 | 总数 | 已修复 | 部分修复 | 不修 | 备注 |
|---|---|---|---|---|---|
| P0 | 3 | 3 | 0 | 0 | 全部根因消除（非表象掩盖） |
| P1 | 7 | 7 | 0 | 0 | 含 1 处随代码事实演进的文档改写（t4-F-03） |
| P2 | 26 | 24 | 1（t1-P2-3） | 1（t3-F7） | t2-F2 按主体方案（SW 绑定）计入已修复，宿主白名单留作可选加固（其处置块记为部分修复，见 §三.2） |
| P3 | 30 | 4 | 4 | 22 | 修复/部分项均为随 P2 顺手落地：t1 P3-2、P3-10、t4 F-15、F-17 全修；t1 P3-3、P3-8、t2 F4、F9 关键子项落地 |
| **合计** | **66** | **38** | **5** | **23** | 另有 0 条误报、1 处审计修正（t4-F-06） |

- **误报**：0（验证报告 §三：「未发现任何审计误报」）。
- **审计修正**：1——t4-F-06（pnpm-workspace.yaml 占位内容）：原审计建议 `onlyBuiltDependencies`（pnpm 10 口径）有误，本机 pnpm 12.3.4 实测合法键为 `allowBuilds`（布尔映射）；修复采用 `allowBuilds: {'@swc/core': true, esbuild: true}`，`pnpm install --frozen-lockfile` 与全量构建实测通过。占位内容问题本身真实存在，属审计建议修正而非误报。
- **不修项均为有意处置**：P3 21 条按「超出低风险边界/无正确性影响/留专项」不修；P2 不修仅 t3-F7（体积/分包结构性重构）1 条；P2 部分修复仅 t1-P2-3（快照端 512 限深已落地，Rust 递归迭代化留专项）1 条。

**最终验证结论（引自 verification-report.md §七）：验证通过。** `pnpm run build` 全量构建 exit 0；`cargo test` wasm 45 passed / host 7 passed；`cargo check --all-targets` 双 crate 通过；`git diff --check` 干净；P0 三项经设计级代码精读确认根因消除；38 条 P2/P3 抽验证据与处置相符；六项回归专项（主题 7 款、[TOC]/锚点、设置即时生效、i18n、WASM 接口约束、JS 镜像一致性）全部通过；未发现修复引入的新回归。

**发布前注意**：当前工作树的 `dist/` 已被还原至 HEAD（未含修复，验证报告 §六.2）——发布或提交前必须重新 `pnpm run build` 使产物与源码一致。

---

## 二、全量 Findings 清单（66 条，按严重度分级）

说明：**位置**为各分区审计时的 file:line（修复后行号可能偏移）；**处置**以各报告处置块与验证报告为准；**验证**列引用 verification-report.md 的对应章节（§二 P0 逐项、§三 P1 逐项、§四 P2/P3 抽验）。t1 指 wasm-core-audit，t2 指 native-host-security-audit，t3 指 extension-code-audit，t4 指 docs-audit。

### 2.1 P0 —— 安全 / 崩溃 / 数据损坏（3 条，全部已修复）

| 编号 | 来源 | 位置 | 问题 | 处置 | 验证 |
|---|---|---|---|---|---|
| t3-F1 | t3 | `src/content/core/markdown.ts:49`、`src/content/App.vue:62`、`markdown.ts:106-110` | 不可信 Markdown `html:true` + `v-html` 无净化渲染（XSS），Mermaid `securityLevel:'loose'` 放大 | 已修复：`html: false` + `securityLevel: 'strict'`；不引入新依赖（约束）；「信任此文档」开关列后续可选 | §二：注入面逐一排查（hljs/TOC 占位/linkify/`validateLink`），全仓 sink 复查无残留路径 |
| t3-F2 | t3 | `App.vue:308-309/336-337`、`file-handle-storage.ts:186-199/15` | 文件句柄按裸文件名冗余存取，跨目录同名文件静默互相覆盖（数据损坏） | 已修复：删除裸文件名维度存储与检索，仅保留完整 file:// URL 键 | §二：两处 `storeFileHandle(fileName,…)` 已删除；`trySilentSave` 仅按完整 URL 命中 |
| t3-F3 | t3 | `App.vue:402`、`src/shared/storage.ts:31/47-57` | 主题切换新建 `useStorage()` 实例，用户全部设置被默认值整体覆盖（数据损坏） | 已修复：`createStorage()` + 模块级 `sharedStorage` 单例；`toggleTheme` 复用同实例 `saveSettings` | §二：同一 JS 上下文共享同一 settings ref，loadSettings 回退与 normalize 语义未变 |

### 2.2 P1 —— 功能错误（7 条，全部已修复）

| 编号 | 来源 | 位置 | 问题 | 处置 | 验证 |
|---|---|---|---|---|---|
| t1-P1-1 | t1 | `wasm/markdown_analyzer/src/dommd.rs:298-365` | 嵌套表格被外层吞并、同行 th/td 列序重排，输出 Markdown 结构损坏（探针实证） | 已修复：`collect_direct_rows` 限直接结构、单元格单趟按文档序、嵌套表格降级 `full_text()`；新增测试；JS 回退同步（t3-F5） | §三：`degrades_nested_table_to_plain_text` 通过 |
| t3-F4 | t3 | `markdown_analyzer.js:539`、`src/content/core/wasm_analyzer.ts:18-28`、`wasm_directory.ts:28` | WASM 未初始化即调用导出函数，多数页面核心算法静默走 JS 回退，「Rust 核心层」未生效 | 已修复：`loadAnalyzer()` 一次性 `await module.default()` 并缓存（失败缓存 null 短路 + debug 日志）；冗余 init 去除 | §三 |
| t3-F5 | t3 | `src/content/core/dom-to-markdown.ts:189-259` 等 | JS 回退往返转换在嵌套列表/表格/围栏/转义上产生错误结果 | 已修复：嵌套列表缩进、任务项/单元格保行内格式、`\|` 转义、行收集限直接结构、围栏按内容加长、`ol` start、快照 512 限深；Rust 侧同规则（t1-P1-1 等）；文本/链接最小转义余项随 t1-P3-3 留双侧专项 | §三：两侧分歧已消除 |
| t3-F6 | t3 | 根 `index.html` | 仓库根 HTML 为无关第三方（ChatGPT 桌面端）产物，混入合规与混淆风险 | 已修复：重写为项目占位说明页（git 历史核实无更早版本可恢复） | §三 |
| t4-F-01 | t4 | `public/_locales/{en_GB,en_US,ja,ko,uk,zh_TW}/messages.json` | 6 语言包残留旧模板品牌（`Markdown Reader`/旧描述），用户可见错误名称与描述；刷新命令文案语义漂移 | 已修复：8 包统一 4 键、`ext_name` 全 MarkCraft、`ext_desc` 按语言翻译；无实现命令的键随 t3-F10 一并删除 | §三：8 包键集合逐一比对一致 |
| t4-F-02 | t4 | `CONTRIBUTING.md:9`、`CONTRIBUTING_zh.md:9` | 引用不存在的 `pnpm run resources:test`，贡献者照做必报错 | 已修复：删除该行，流程改为 `pnpm install` → `pnpm run build` | §三：与 package.json/CI 一致 |
| t4-F-03 | t4 | `docs/codebase_analysis.zh-CN.md:123` | 权限描述失实（「仅 storage/tabs」漏 `nativeMessaging`，隐私敏感） | 已修复：按 t8 后新事实改写为「storage / nativeMessaging」，快捷键同步改为 2 个（tabs 权限已随 t3-F13 移除、两个无实现 command 已随 t3-F10 删除） | §三：与 manifest 现状一致 |

### 2.3 P2 —— 健壮性 / 性能（26 条官方计数：24 修 + 1 部分 + 1 不修；另 t1-P2-5 并入 t1-P1-1 关联、同为已修复）

| 编号 | 来源 | 位置 | 问题 | 处置 | 验证 |
|---|---|---|---|---|---|
| t1-P2-1 | t1 | `outline.rs:38-50`、`src/content/core/outline.ts:12-21` | slug 去重只记基名，可产生重复 href 与重复 DOM id | 已修复：`unique_slug`（HashSet 已用集合）+ JS 镜像同步；新增测试 | §四抽验 |
| t1-P2-2 | t1 | `dommd.rs:171-175`、`dom-to-markdown.ts:133` | 代码块内容含 ``` 时围栏提前闭合，后续正文被吞 | 已修复：`longest_backtick_run` + `fence()`（块级/mermaid/行内），CommonMark 补空格；双侧同步；新增测试 | §四抽验 |
| t1-P2-3 | t1 | `dommd.rs` 多处递归、`lib.rs:68-71` | 超深 DOM 嵌套触发递归爆栈（release 60k–80k 层；wasm32 阈值更低） | **部分修复**：快照端 512 层限深已落地（t3-F5）；Rust 显式栈迭代化与入口限深未做——调用方全 try/catch 回退且回退自身已限深，链路优雅失败 | §四未修类：理由成立，留专项 |
| t1-P2-4 | t1 | `directory.rs:153-157`、`folder.ts:40-56` | `ancestor_folder_urls` 前缀混淆（root 无尾斜杠时误匹配兄弟目录） | 已修复：`ensure_trailing_slash` 归一化 + JS 镜像同步；新增测试 | §四抽验 |
| t1-P2-5 | t1 | `dommd.rs:309-311` | 同行 th/td 混排列序重排（P1-1 关联条目，并入计数） | 已修复：与 P1-1 同一改动（单趟按文档序） | §四抽验 |
| t2-F1 | t2 | `main.rs:77/79` | 临时文件名可预测且 `fs::write` 跟随已存在符号链接（本机共享目录攻击） | 已修复：`create_new(true)`（O_EXCL）+ pid/纳秒/尝试序号 + 换名重试；新增符号链接测试 | §四抽验 |
| t2-F2 | t2 | `background/index.ts:22-41`、`main.rs:53-59` | SW 中继不绑定 sender/path + 宿主无写范围白名单（纵深防御缺口） | 已修复（主体）：SW 校验 `sender.id`、`sourceUrl` 须 file://、`path === fileUrlToNativePath(sourceUrl)`、绝对路径、≤64M（随 t3-F14 落地，写入面收敛到当前浏览文档）；宿主侧白名单留作后续可选加固（t2 处置块口径为部分修复，见 §三.2 交叉核对） | §四抽验（计入已修复类） |
| t2-F3 | t2 | `main.rs:58/79` | `rename` 替换符号链接本体致静默数据分叉 + TOCTOU | 已修复：`symlink_metadata` 显式拒绝符号链接目标；unix 测试断言；与 F1 共同收窄竞态窗口 | §四抽验 |
| t3-F7 | t3 | `dist/content/index.global.js`（约 5.2MB）、`style.css`（约 1.5MB）、`manifest.json:60` | 内容脚本体积过大，document_start 注入每个匹配页 | **不修**：按需加载/分包属结构性重构，document_idle 会改变页面接管时序（原文闪烁），超低风险边界，留后续专项 | §四未修类 |
| t3-F8 | t3 | `App.vue:208-219`、`markdown.ts:108` | 渲染管线无时序守卫；主题切换后 Mermaid 图表配色过期 | 已修复：`updateMarkdown` 渲染序号守卫 + `rerenderMermaidDiagrams()`（主题切换/storage.onChanged 双触发） | §四抽验；回归专项确认新增能力无回归 |
| t3-F9 | t3 | `enhancements.ts:39/51-57/65-70/73-79` | `innerHTML` 赋值在 Trusted Types 强制页抛错，代码块增强失效且中断后续增强 | 已修复：复制按钮/圆点全 `createElement(NS)`；pre/img/heading 独立 try/catch | §四抽验 |
| t3-F10 | t3 | `manifest.json:24-41`、`App.vue:552-557` | `toggleCentered`/`toggleRefresh` 快捷键无任何实现（空占位） | 已修复（t8 落地，自 t5 移交）：manifest 删除两 command（保留 2 个）；8 语言包对应键删除；全仓无残留引用 | §四抽验；i18n 回归确认键完整 |
| t3-F11 | t3 | `export.ts:76` | 导出单文件 HTML 标题未转义（可注入 `</title><script>`） | 已修复：title HTML 转义；正文随 F1 `html:false` 一并安全 | §四抽验 |
| t3-F12 | t3 | `file-handle-storage.ts:24-36` | IndexedDB 连接按操作打开从不关闭，高频堆积 | 已修复：模块级懒加载单例 + `onversionchange` 关闭清缓存 | §四抽验 |
| t3-F13 | t3 | `manifest.json:74` | `"tabs"` 权限非必需，违反权限最小化 | 已修复（t8 落地，自 t5 移交）：permissions 收敛为 `["storage","nativeMessaging"]`；t3-F14 校验不依赖 tabs | §四抽验；dist 产物抽检一致 |
| t3-F14 | t3 | `background/index.ts:22-46` | `native-save` 消息无来源与范围校验（纵深防御） | 已修复：五重校验（sender.id / file:// / path 推导一致 / 绝对路径 / ≤64M）+ 消息新增 `sourceUrl` | §四抽验 |
| t3-F15 | t3 | `App.vue:475-504` | 全局快捷键劫持宿主页输入框按键 | 已修复：可编辑元素焦点守卫；扩展内 Cmd+K/Cmd+S 保留 | §四抽验 |
| t4-F-04 | t4 | `README_zh.md` | ZH 缺 EN 版「零弹窗保存/native-host」章节与文档索引 | 已修复：补译章节 + build:wasm/wasm-pack 说明 + 文档区补齐 | §四抽验 |
| t4-F-05 | t4 | `README.md:18-21` | README 用 `npm`，仓库/CI 实际基于 pnpm（仅 pnpm-lock.yaml） | 已修复：README 中英统一 pnpm 口径并注明 wasm-pack | §四抽验 |
| t4-F-06 | t4 | `pnpm-workspace.yaml:1-2` | 占位残文（“set this to true or false”） | 已修复（**含 1 处审计修正**）：`allowBuilds: {'@swc/core': true, esbuild: true}`——原审计建议的 `onlyBuiltDependencies` 为 pnpm 10 口径，pnpm 12 实测不适用，处置块已修正审计建议 | §三：实测 `pnpm install --frozen-lockfile` + 构建全链路通过 |
| t4-F-07 | t4 | `docs/codebase_analysis.zh-CN.md:61` | 主题清单漏 verdant/dracula（实际 7 态） | 已修复：改为 7 态全列 | §四抽验 |
| t4-F-08 | t4 | `docs/codebase_analysis.zh-CN.md:87` | 「popup 主题四态」过期（实际 7 态） | 已修复：改为「主题七态」 | §四抽验 |
| t4-F-09 | t4 | `docs/codebase_analysis.zh-CN.md:31/102-109` | Rust 测试数过期且表格与总数自相矛盾（34 vs 33） | 已修复：更新为 45（directory 8/dommd 22/outline 5/slug 4/palette 4/stats 2）并加「以实时输出为准」 | §四抽验；与验证实测 45 passed 一致 |
| t4-F-10 | t4 | `docs/codebase_analysis.zh-CN.md:124` | 「9 语言」实为 8 个 locale 目录 | 已修复：改为 8 语言全列 | §四抽验 |
| t4-F-11 | t4 | `docs/codebase_analysis.zh-CN.md:58` | 「Markdown 下载」误归 export.ts（实现实际在 App.vue） | 已修复：export.ts 职责更正，App.vue 补「Markdown 原文下载」 | §四抽验 |
| t4-F-12 | t4 | `docs/codebase_analysis.zh-CN.md:142-144` | 列出已不存在的 `.trellis//.agents/` 目录 | 已修复：删除两行，`​.codex/`、`reference/` 标注 git-ignore 属性 | §四抽验 |
| t4-F-13 | t4 | `docs/wasm_core.md:30` ↔ `wasm_core.zh-CN.md:27-28` | 中英措辞不一致（"scoring" vs「统计」，代码实为 `doc_stats`） | 已修复：EN 改 statistics | §四抽验 |

### 2.4 P3 —— 建议 / 文档一致性（30 条：4 修 + 4 部分 + 22 不修）

| 编号 | 来源 | 位置 | 问题摘要 | 处置 | 验证 |
|---|---|---|---|---|---|
| t1-P3-1 | t1 | `dommd.rs:184-191` | h7–h9 产出非法 ATX 标题（HTML 无 h7+，健壮性） | 不修（留后续；与 JS 回退存在轻微分歧） | §四未修类 |
| t1-P3-2 | t1 | `dommd.rs:249-260` | 任务列表项 `full_text()` 丢失行内格式/嵌套结构 | 已修复：`children_to_markdown` + 缩进 + `ol` start；3 个新测试；JS 同步 | §四抽验 |
| t1-P3-3 | t1 | `dommd.rs:179-181/232-240` | 行内代码/链接/图片不做最小转义 | 部分修复：行内代码围栏已加长（随 P2-2）；文本 `*`/`_`、链接 `]`/`)` 转义未做（双侧一致缺口，留双侧专项） | §四抽验（部分） |
| t1-P3-4 | t1 | `directory.rs:52-69` | `read_number` 混合符号串整体归 0 | 不修（边界保守回退，无数据损坏） | §四未修类 |
| t1-P3-5 | t1 | `slug.rs:39` | `trim_matches(' ')` 死代码（JS/Rust 一致，测试锁定） | 不修 | §四未修类 |
| t1-P3-6 | t1 | `palette.rs:10-33` | palette 字段名拼错静默取默认（风险已在文档记载） | 不修 | §四未修类 |
| t1-P3-7 | t1 | `palette.rs:93-112` | 空查询全量扁平化 + 逐条 to_lowercase 分配（性能） | 不修 | §四未修类 |
| t1-P3-8 | t1 | `dom-to-markdown.ts:235-259` vs `dommd.rs:298-352`、`docs/wasm_core.md:5-7` | JS 回退与 WASM 表格序列化不同构，「行为完全一致回退」声明过强 | 部分修复：代码分歧已大幅收敛（随 t3-F5 + 本批 Rust 同步）；`docs/wasm_core.md` 措辞收敛未做（本次交叉核对确认 `docs/wasm_core.md:5` 仍为 behavior-identical），留文档批处理 | §四未修类（文档部分） |
| t1-P3-9 | t1 | `directory.rs:13/15` 等 | i64/u64 超 ±2^53 序列化为 BigInt（当前取值远低于阈值，契约成立） | 不修（建议文档补注记，见 §四路线） | §四未修类 |
| t1-P3-10 | t1 | `wasm_directory.ts:28` 等 | 每次调用前冗余 `await wasm.default()` | 已修复（随 t3-F4）：loadAnalyzer 一次性初始化并缓存 | §四抽验 |
| t2-F4 | t2 | `main.rs:69-85` | 覆盖保存不保留原文件 mode/属主/xattr，且无 fsync | 部分修复：`sync_all()` 已加（数据先落盘再原子替换）；权限/属主复制未做 | §四未修类（部分注明） |
| t2-F5 | t2 | `main.rs:12/19/22` | 512MB 入站上限 + 按长度头整块预分配 | 不修（对端仅 Chrome，SW 侧另有 64M 字符上限） | §四未修类 |
| t2-F6 | t2 | `install.sh:70-83` | JSON 内插不转义 + 无条件写三个浏览器目录 | 不修（极特殊目录名才触发，failsafe） | §四未修类 |
| t2-F7 | t2 | `install.sh:33-34/77` | 宿主二进制驻留仓库 target/ 可被同机写者替换 | 不修（前置条件与「已能写仓库」重叠） | §四未修类 |
| t2-F8 | t2 | `install.sh:41`、`README.md:21-24` | allowed_origins 依赖「安装目录==加载目录」，失配静默回退（可用性） | 不修（失败模式安全回退） | §四未修类 |
| t2-F9 | t2 | `background/index.ts:41/32-40`、`native-save.ts:5,34` | SW 中继缺入参类型校验与超时断开；超时后可能双写竞态 | 部分修复：path/content/sourceUrl 类型与上限校验已随 t3-F14 落地；SW 超时 `port.disconnect()` 未做（内容侧 4s 兜底保留，双写内容一致） | §四未修类（部分注明） |
| t2-F10 | t2 | `native-save.ts:12` | Windows 路径静默禁用（行为安全；未来支持需显式处理盘符/UNC） | 不修（维持「Windows 暂不支持」口径） | §四未修类 |
| t2-F11 | t2 | `main.rs:79` | BOM 与原 CRLF 不保留（数据保真提示，无安全影响） | 不修 | §四未修类 |
| t3-F16 | t3 | `src/shared/i18n.ts`（零引用）等 | 运行时 UI 未接入 i18n，文案硬编码中文 | 不修（留专项） | §四未修类 |
| t3-F17 | t3 | `folder.ts:16-25`、`background/index.ts:4-20` | 本地目录树受「允许访问文件网址」开关制约且无用户提示（空目录而非报错） | 不修（留引导提示专项） | §四未修类 |
| t3-F18 | t3 | `folder.ts:16-26` | 目录请求缓存与错误路径小问题（unhandledrejection、lastError 未读） | 不修 | §四未修类 |
| t3-F19 | t3 | `doc-stats.ts:10-14` | 回退把所有语言字符数当词数（英文时长高估约 5 倍） | 不修 | §四未修类 |
| t3-F20 | t3 | `outline.ts:12-21` | 空 slug 产生 `href='#'` 与非法空 id | 不修（双侧一致） | §四未修类 |
| t3-F21 | t3 | `index.ts:69/44/46` | 接管行为细节（body 类名冲突风险、`.` 目录误判、多 pre 取首个） | 不修（验证报告确认 `index.ts:69` 未改） | §四未修类 |
| t3-F22 | t3 | `theme.ts:5-9`、`App.vue:150` | 缺 prefers-color-scheme 变更监听；`currentTheme` 类型缺 `verdant\|dracula` | 不修（验证报告遗留观察点名 `App.vue:150`，本次交叉核对确认仍在） | §四未修类 |
| t3-F23 | t3 | `scripts/build.mjs` | 无 sourcemap；内容脚本 CSS 文件名靠 Vite 隐式决定；watch 递归未 await | 不修 | §四未修类 |
| t4-F-14 | t4 | `SECURITY.md:3`、`SECURITY_zh.md:3` | 安全联系方式不具体（无邮箱/私有漏洞报告入口） | 不修（P3） | §四未修类 |
| t4-F-15 | t4 | `docs/codebase_analysis.zh-CN.md:77-86` | 组件分节标题与实际路径（`src/components/`）不符 | 已修复：标题改为「shared/、components/ 与其余 UI 面」并标注路径 | §四抽验 |
| t4-F-16 | t4 | `docs/rendering_review.zh-CN.md:46` | 外链使用 http（theme.typora.io） | 不修（P3） | §四未修类 |
| t4-F-17 | t4 | `README.md:33-38` | EN 文档索引未收录 performance 中文版与 rendering_review | 已修复：索引补齐 | §四抽验 |

---

## 三、P0/P1 证据交叉核对

汇总人对全部 3 条 P0 与 7 条 P1 在**当前工作树**逐条独立复核了处置块与验证报告所引用的代码事实（非转述）。结论：**全部相符，未发现矛盾**。

### 3.1 逐条独立复核结果

| 编号 | 验证报告结论 | 汇总人独立复核（当前代码） | 一致性 |
|---|---|---|---|
| t3-F1 | §二：`html:false`（markdown.ts:52）、`securityLevel:'strict'`（:114），注入面排查无残留 | 实测 `markdown.ts:52 html: false`、`:114 securityLevel: 'strict'` | ✅ |
| t3-F2 | §二：裸文件名存储/检索已删，仅完整 URL 键 | 实测 `App.vue:314/341` 仅 `storeFileHandle(fileUrl,…)`；`file-handle-storage.ts:206` 按 `fileUrl` 检索；`splitFileUrl`（:165）仅用于目录下钻的 `create:false` 合法路径 | ✅ |
| t3-F3 | §二：单例共享 + toggleTheme 复用同实例 | 实测 `storage.ts:30 createStorage`、`:69-75 sharedStorage` 单例；`App.vue:206` 解构 `saveSettings`、`:408` 复用 | ✅ |
| t3-F4 | §三：loadAnalyzer 一次性 init 并缓存 | 实测 `wasm_analyzer.ts:28 await analyzer.default()`；`wasm_directory.ts` 无独立 `.default()` 调用 | ✅ |
| t3-F5 | §三：回退规则对齐、512 限深、分歧消除 | 实测 `dom-to-markdown.ts:25 MAX_SNAPSHOT_DEPTH = 512`；围栏/表格/列表规则在位（验证报告 §五 JS↔Rust 逐规则比对一致） | ✅ |
| t3-F6 | §三：index.html 重写为占位说明页 | 实测 `<title>MarkCraft</title>`（index.html:6），无第三方产物痕迹 | ✅ |
| t1-P1-1 | §三：`collect_direct_rows` + 单趟 th/td + 嵌套降级，测试通过 | 实测 `dommd.rs:342 collect_direct_rows(...)`；`:324` 嵌套降级 `full_text()` 分支在位 | ✅ |
| t4-F-01 | §三：8 包 4 键统一，全 MarkCraft | 实测脚本遍历 8 个 messages.json：键集合均为 `[command_toggle_side, command_toggle_theme, ext_desc, ext_name]`，`ext_name` 均为 MarkCraft | ✅ |
| t4-F-02 | §三：无 resources:test | 实测 CONTRIBUTING 双语仅 `pnpm install` → `pnpm run build` | ✅ |
| t4-F-03 | §三：权限描述与 t8 后事实一致 | 实测 `codebase_analysis.zh-CN.md:123`「permissions 为 storage / nativeMessaging…2 个快捷键命令」；`manifest.json:62 permissions ["storage","nativeMessaging"]`、commands 仅 togglePageTheme/toggleSide（:24/:30）——三方（文档/manifest/验证）一致 | ✅ |

补充核对（与 P1 相关的数字一致性）：静态 `#[test]` 计数 wasm = 8+22+5+2+4+4 = **45**、host = **7**，与验证报告 `cargo test` 实测（45/7 passed）及 t4-F-09 修复后的文档表述完全一致。

### 3.2 交叉核对中发现的口径性观察（均不构成事实矛盾，不阻塞结论）

1. **t2-F2 的处置级别表述差异**：t2 报告处置块记为「部分修复」（宿主侧白名单未做），验证报告将其计入已修复抽验类（SW 侧绑定方案 = 建议方案 1，已随 t3-F14 落地）。两者描述的是同一事实的两面：**主方案已落地并验证，宿主白名单是明确留作后续的可选加固**。本总报告按验证报告口径计入「P2 已修 24 条」，并在 §四路线中保留该残余子项。
2. **验证报告的抽样统计为约数**：§四称「抽验 38 条（约 60 条中的 63%）」——按本总报告逐条清点，P2/P3 编号条目合计 56（官方口径），38/56 ≈ 68%；「约 60/63%」系验证报告的约数表述，且其「已修复类（23 条抽验通过）」的示例列举实为 30 条左右（含合并列示）。差异仅影响抽样覆盖率的精度表述，**38 条抽验与其证据相符的结论本身不受影响**（38 ≥ 30% 门槛仍成立）。
3. **验证期间工作树波动的留痕**（引自验证报告 §六.1）：02:37–03:02 存在一轮「回滚→重新应用」（t5 范围收窄 + t8 重落地），验证结论针对 03:05 起的最终稳定树。本次汇总以当前树复核与该结论一致。

---

## 四、剩余未修项的修复优先级建议与路线

> **第二轮处置（security-reviewer，2026-09-13，剩余未修项清理）——本节所列 28 条已全部处置完毕，状态如下：**

| 分档 | 条目 | 处置 |
|---|---|---|
| 第一档·快修 | t3-F22 类型收窄、t1-P3-8 措辞、t1-P3-9 i64 注记、t1-P3-1 标题级别、t2-F4 权限复制、t4-F-14/F-16 | **7/7 已修复**（详见各分区报告第二轮处置块） |
| 第二档·专项 | t1-P2-3 Rust 迭代化+限深、t1-P3-3 最小转义（双侧）、t3-F16 i18n、t2-F2 宿主白名单、t2-F9 SW 超时、t3-F17 权限引导 | **4 修复 + 2 部分落地**（t3-F16：基建与内容脚本 UI 全量迁移完成并新增 8 语言包 6 键，SFC 组件约 150 处文案留翻译审校专项；t3-F17：失败状态跟踪与权限引导落地，Side 面板可视化横幅留专项） |
| 第三档·结构性 | t3-F23 构建校验、t3-F18/F19/F20/F21、t1-P3-4/5/6/7、t2-F5/F6/F7/F8/F9 | **12/13 修复**（t3-F21 之 `mdr` 类名改名经评估不修：压缩 CSS 大面积引用，收益低于风险，证据见分区报告） |
| 第三档·产品决策 | t3-F7 分包/时序、t2-F10 Windows、t2-F11 BOM/CRLF | **决策落痕**：F7 内容脚本为单文件 IIFE 硬约束无法分包、run_at 保持 document_start（idle 会致原文闪烁），按需加载留结构性专项（build.mjs 注释留痕）；F10 维持「Windows 暂不支持」；F11 维持不修（保存内容为 DOM 往返再生成，保留原 BOM/CRLF 无实义） |

**第二轮汇总**：原 28 条清单及 F2 残余（宿主白名单，P2）共 29 项——**修复 23、部分落地 3**（t3-F16、t3-F17、t3-F21）、**决策性维持 3**（t3-F7、t2-F10、t2-F11）。全量验证：`pnpm run build`（含新增 manifest 引用校验）通过，wasm `cargo test` 55 通过（第二轮新增 10 个），宿主 `cargo test` 11 通过（新增 4 个），双 crate `cargo clippy -D warnings` 干净，`git diff --check` 干净（dist 按惯例还原，发布前重新构建）。剩余可做项只剩两个明确的后续专项：Vue SFC 文案国际化审校、内容脚本按需加载（均已在分区报告留痕）；`mdr` 类名改名与 t2-F11 经评估维持不修。

---

## 四·（历史）修复路线原始建议

> 以下为 2026-09-12 复核时的原始排期建议，保留作为决策依据；实际处置结果见上方第二轮处置表。

## 五、附录

### 5.1 报告索引

| 文件 | 审计人/角色 | Findings 编号体系 | 条数 | 交叉核对状态 |
|---|---|---|---|---|
| `docs/audit/wasm-core-audit.md`（t1） | rust-reviewer | P1-1；P2-1..P2-5；P3-1..P3-10 | 官方 15（P2-5 并入 P1-1 关联） | 处置块与验证一致 |
| `docs/audit/native-host-security-audit.md`（t2） | security-reviewer | F1..F11 | 11（P2×3、P3×8） | 处置块与验证一致（F2 级别表述见 §三.2） |
| `docs/audit/extension-code-audit.md`（t3） | ext-reviewer | F1..F23 | 23（P0×3、P1×3、P2×9、P3×8） | 处置块与验证一致 |
| `docs/audit/docs-audit.md`（t4） | docs-reviewer | F-01..F-17 | 17（P1×3、P2×10、P3×4） | 处置块与验证一致 |
| `docs/audit/verification-report.md`（t6） | verifier（独立） | —（按四报告逐条对照） | 处置状态权威来源 | 本报告 §三 已独立复核 P0/P1 全部证据 |

### 5.2 复核与修复过程纪要（可信度留痕）

1. **分区审计（t1–t4）**：四名复核者在只读约束下分别完成 WASM/Rust 绑定、宿主与文件写入链路、扩展层 13 文件、全部文档的精读；t1 以 `/tmp` scratch crate 对边界行为做了 9 组实证探针（嵌套表格损坏、slug 碰撞、递归爆栈等均有可复现证据）；t2 完成路径穿越/任意写/协议边界/来源校验/输入编码/错误处理/最小权限七项必查；t3 完成 XSS/句柄生命周期/存储竞态三类必查；t4 完成中英逐对比对与文档↔代码逐条核对（外部链接全部探测）。
2. **修复执行（t5 + t8）**：t5 原定覆盖扩展侧 13 文件，执行中按队长范围调整发生拆分——`public/**`（manifest 与语言包）移交 security-reviewer（t3-F10/F13 的处置块留有移交记录），Rust/宿主/文档侧归入 t8；t8 期间工作树经历一次「回滚 → 从交接备份恢复重落地」（`wasm/markdown_analyzer/src/{dommd.rs,outline.rs,directory.rs}` + JS 镜像 `outline.ts`/`folder.ts`），最终稳定树自 03:05 起无变化（验证报告 §六.1 留有中间快照 `/tmp/t6-surviving-diff.patch` 与全部命令输出）。
3. **独立验证（t6）**：验证人独立于修复执行者，全量重跑构建/测试（wasm 45、host 7 全绿），P0 三项做设计级根因精读，38 条 P2/P3 抽验，六项回归专项（含主题 7 款、[TOC]/锚点、设置即时生效、i18n 键完整、WASM 接口约束、JS 镜像与 Rust 一致性）全部通过；`dist/` 已 `git restore` 还原至 HEAD（发布前需重新构建）。
4. **汇总（t7，本报告）**：docs-reviewer 对 P0/P1 全部证据做当前树独立复核（§三.1，10/10 相符），对统计口径做逐条清点（§五.3），指出 3 项口径性观察（§三.2，均不阻塞）；除本文件外未改动任何工作区文件。

### 5.3 统计口径说明（保证数字可复算）

- **总数 66** = t1 官方 15（P0×0、P1×1、P2×4、P3×10；编号条目 P2-5 作为 P1-1 关联并入计数，其处置同为已修复，不影响统计）+ t2 11 + t3 23 + t4 17。
- **P2 = 26**（t1 4 + t2 3 + t3 9 + t4 10）：已修 24 = t1 P2-1/2/4（P2-5 随 P1-1）+ t2 F1/F2/F3 + t3 F8–F15 + t4 F-04–F-13；部分 1 = t1-P2-3；不修 1 = t3-F7。
- **P3 = 30**（t1 10 + t2 8 + t3 8 + t4 4）：完全修复 4 = t1 P3-2/P3-10 + t4 F-15/F-17；部分落地 4 = t1 P3-3/P3-8 + t2 F4/F9（关键子项随 P2 修复带入）；不修 22。若按「有实质修复落地即计入」的宽松口径（即处置汇总所用的「P3 顺手修 6 条」），为上列完全修复 4 条 + t2 F4/F9 两条主要落地方。
- **P0/P1 全修**：3 + 7，均有验证报告 §二/§三 逐项结论与本报告 §三.1 独立复核双重确认。
- **误报 0、审计修正 1**（t4-F-06，详见 §一）。
- **验证抽样**：38 条 P2/P3（验证报告口径「约 60 条中的 63%」；精确分母 56，见 §三.2 观察 2）。
