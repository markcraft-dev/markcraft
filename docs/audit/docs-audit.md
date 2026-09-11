# MarkCraft 文档全量复核报告（docs-audit）

- 审阅人：docs-reviewer（全量复核团队）
- 日期：2026-09-12
- 范围：README.md / README_zh.md、CONTRIBUTING* / SECURITY* / CODE_OF_CONDUCT*、native-host/README.md、docs/{wasm_core*, performance_optimization*, codebase_analysis.zh-CN.md, rendering_review.zh-CN.md}、.github/pull_request_template{,_zh}.md、public/manifest.json 描述字段与 public/_locales/*/messages.json
- 方法：中英文档逐对精读比对；文档中的构建命令、安装步骤、功能清单、快捷键、权限说明逐条与 package.json、public/manifest.json、scripts/、src/、native-host/、wasm/ 实际代码核对；外部链接逐一探测 HTTP 状态。
- 约束遵守：本次仅新增本报告文件，未改动任何其他工作区文件。

---

## 一、结论概览

总体判断：文档质量较好，`docs/wasm_core.*`、`docs/performance_optimization.*` 的代码级断言与代码高度一致（构建命令、导出函数、缓存策略、限额、体积等均逐条核实通过）；`native-host/README.md` 与 install.sh / 宿主源码一致。主要问题集中在：① `_locales` 多语言包残留旧模板品牌（P1）；② CONTRIBUTING 引用不存在的 npm script（P1）；③ `docs/codebase_analysis.zh-CN.md` 存在多处与近期改动脱节的过期描述（权限清单、主题数量、测试数、语言数等，P2）；④ README_zh 缺少英文版新增章节（P2）。

### 统计

| Severity | 数量 | 说明 |
|---|---|---|
| P0 | 0 | 未发现安全/崩溃/数据损坏级问题（未发现误导性安全声明） |
| P1 | 3 | 与代码事实不符 |
| P2 | 10 | 双语不一致 / 内容过期 |
| P3 | 4 | 文字与体例建议 |

---

## 二、Findings 明细

### F-01 [P1] `_locales` 6 个语言残留旧模板品牌，用户可见的扩展名与描述错误

> **处置（security-reviewer，2026-09-12）：** 已修复 — 8 个语言包统一为 4 键结构（`ext_name`/`ext_desc`/`command_toggle_theme`/`command_toggle_side`）：`ext_name` 全部 MarkCraft；`ext_desc` 按各语言翻译 en 包描述；`command_toggle_centered`/`command_toggle_refresh` 键随 t3-F10（移除无实现的 command）一并删除，"自动刷新"语义错误随之消失。全部 JSON 校验通过。
- 位置：`public/_locales/en_GB/messages.json`、`en_US/messages.json`、`ja/messages.json`、`ko/messages.json`、`uk/messages.json`、`zh_TW/messages.json`
- 证据：`manifest.json` 的 `default_locale` 为 `en`，en 包为 `ext_name: "MarkCraft"`、`ext_desc: "Crafted Markdown Reader & In-Browser WYSIWYG Editor Extension"`（与 package.json description 一致）；但 en_US / en_GB / ja / ko / uk / zh_TW 六个包仍为旧模板内容：`ext_name: "Markdown Reader"`、`ext_desc: "The best way to preview Markdown in your browser."`（及其日/韩/乌/繁译文）。英文（en_US/en_GB）用户经 Chrome 语言匹配会优先命中 `en_US` 目录，商店与 `chrome://extensions` 中将显示错误的产品名与描述；`command_toggle_refresh` 在 zh_TW（“切換自動刷新”）/ ja（“自動更新の切り替え”）/ uk（“Загальне перезавантаження”）中描述为“自动刷新/整体重载”，与 en（“Refresh Document”）/ zh_CN（“刷新 Markdown 文档”）的实际语义不符。
- 建议修订文本：将六语言包的 `ext_name` 统一为 `MarkCraft`，`ext_desc` 按各语言翻译 en 包描述（如 zh_TW：「極美排版與所見即所得的 Markdown 瀏覽器閱讀與寫作工作台」）；并将 `command_toggle_refresh` 各语言文案对齐“刷新文档”语义。

### F-02 [P1] CONTRIBUTING 引用不存在的 npm script `resources:test`

> **处置（security-reviewer，2026-09-12）：** 已修复 — CONTRIBUTING.md 与 CONTRIBUTING_zh.md 的开发步骤删除 `pnpm run resources:test` 行，改为 `pnpm install` → `pnpm run build`（未补脚本：资源校验无现实需求）。
- 位置：`CONTRIBUTING.md:9`、`CONTRIBUTING_zh.md:9`
- 证据：两文件的开发步骤均为 `pnpm install` → `pnpm run resources:test` → `pnpm run build`；但 `package.json` 的 `scripts` 仅有 `dev`、`build:wasm`、`build`，无 `resources:test`；`.github/workflows/ci.yml` 也只运行 `pnpm install --frozen-lockfile` 与 `pnpm run build`。贡献者照做必然报错 "Missing script"。
- 建议修订文本：删除该行，改为 `pnpm install` → `pnpm run build`；或如确需资源校验步骤，先在 package.json 中补齐 `resources:test` 脚本再写入文档。

### F-03 [P1] codebase_analysis 声称“permissions 仅 storage/tabs”，与 manifest 不符

> **处置（security-reviewer，2026-09-12）：** 已修复 — 文档改为「permissions 为 storage / nativeMessaging（nativeMessaging 仅用于可选的本机写入宿主，未安装宿主时该能力不生效，保存回退目录授权 + 另存对话框）」。注意代码侧 manifest 已随 t3-F13 实际移除 `tabs` 权限，文档按新事实描述；「4 个快捷键命令」同步改为 2 个（t3-F10 移除两个无实现 command）。
- 位置：`docs/codebase_analysis.zh-CN.md:123`
- 证据：原文“permissions 仅 storage/tabs”；`public/manifest.json:74` 实为 `"permissions": [ "storage", "tabs", "nativeMessaging" ]`。`nativeMessaging` 是隐私敏感权限（配合 native-host 静默写盘），文档以“仅”字排除它，属于与代码事实不符，且对隐私评估有误导。
- 建议修订文本：「permissions 为 storage / tabs / nativeMessaging（nativeMessaging 仅用于可选的本机写入宿主，未安装宿主时该能力不生效，保存回退目录授权 + 另存对话框）」。

### F-04 [P2] README_zh 缺少英文版的“零弹窗保存 / native-host”章节与文档索引

> **处置（security-reviewer，2026-09-12）：** 已修复 — README_zh 补译「可选：本地文件零弹窗保存」章节（file:// 不透明来源 + `cd native-host && ./install.sh`），开发段补 `pnpm run build` 的 build:wasm/wasm-pack 说明；文档区补齐 wasm_core.zh-CN、codebase_analysis、performance_optimization（中英对照）、rendering_review。
- 位置：`README_zh.md`（对照 `README.md:25-38`）
- 证据：EN 版有 `### Optional: zero-dialog saves for local files`（file:// 透明来源说明 + `cd native-host && ./install.sh`）与含 4 条链接的 `## Documentation`；ZH 版完全没有 native-host 章节，`## 文档` 仅一条「[English documentation](README.md)」回链，未列出 wasm_core / codebase_analysis / performance_optimization 等中文文档。ZH「开发」段落也缺 EN 对 `npm run build`（先 build:wasm、需 wasm-pack）的解释。
- 建议修订文本：为 README_zh 补译「可选：本地文件零弹窗保存」一节（说明 file:// 页面 IndexedDB 受限、授权无法持久化，安装 `native-host` 后可直接覆盖保存），并将文档区补齐：[WASM 核心层架构](docs/wasm_core.zh-CN.md)、[代码库全量分析](docs/codebase_analysis.zh-CN.md)、[性能优化说明](docs/performance_optimization.zh-CN.md)。

### F-05 [P2] README 安装命令用 `npm`，仓库与 CI 实际基于 pnpm

> **处置（security-reviewer，2026-09-12）：** 已修复 — README「开发」改 `pnpm install` / `pnpm run build`，并显式注明需先安装 wasm-pack；README_zh 同步。
- 位置：`README.md:18-21`（对照 `CONTRIBUTING.md`、`.github/workflows/ci.yml`、`pnpm-lock.yaml`）
- 证据：README 写 `npm install` / `npm run build`；仓库只提交了 `pnpm-lock.yaml`（无 package-lock.json），CI 使用 `pnpm install --frozen-lockfile` + `pnpm run build`，CONTRIBUTING 与 PR 模板均为 pnpm 口径。`npm install` 虽可运行但忽略锁文件，依赖解析可能与 CI 不一致。
- 建议修订文本：README「开发」统一为：

  ```bash
  pnpm install
  pnpm run build
  ```

  并注明需先安装 `wasm-pack`（`npm run build` 会先执行 `build:wasm`）。

### F-06 [P2] pnpm-workspace.yaml 为未完成的占位内容

> **处置（security-reviewer，2026-09-12）：** 已修复（按实测口径修正）— fix-engineer 落地的修复为 `allowBuilds: {'@swc/core': true, esbuild: true}`，本环境 pnpm 12.3.4 实测合法键即 `allowBuilds`（布尔值）；本报告原建议的 `onlyBuiltDependencies` 是 pnpm 10 口径，实测仍 `ERR_PNPM_IGNORED_BUILDS` exit 1。保留该修复（`pnpm install --frozen-lockfile` exit 0，构建闭环依赖它），占位内容已不存在。
- 位置：`pnpm-workspace.yaml:1-2`
- 证据：文件内容为 `allowBuilds:\n  esbuild: set this to true or false`——“set this to true or false” 是字面占位符；pnpm 的合法键名为 `onlyBuiltDependencies` / `neverBuiltDependencies`，不存在 `allowBuilds`。该文件影响 CONTRIBUTING 所述 `pnpm install` 流程的规范性（pnpm 10 起对依赖构建脚本收紧审批）。
- 建议修订文本：改为 `onlyBuiltDependencies:\n  - esbuild`，或在本单包仓库中直接删除该文件。

### F-07 [P2] codebase_analysis 主题清单过期：漏掉 verdant 与 dracula

> **处置（security-reviewer，2026-09-12）：** 已修复 — theme.ts 行改为「主题（auto/light/sepia/verdant/dark/nordic/dracula 共 7 态）…」。
- 位置：`docs/codebase_analysis.zh-CN.md:61`
- 证据：原文「`core/theme.ts` | 主题（auto/light/sepia/dark/nordic）与字体/字号/宽度/自定义 CSS 应用」；实际 `theme.ts:1` 为 7 主题 `'auto' | 'light' | 'sepia' | 'verdant' | 'dark' | 'nordic' | 'dracula'`，且 `markdown.css` 已含 nordic/dracula/verdant 主题块（含深色 hljs 令牌覆盖）。
- 建议修订文本：「主题（auto/light/sepia/verdant/dark/nordic/dracula 共 7 态）与字体/字号/宽度/自定义 CSS 应用」。

### F-08 [P2] codebase_analysis「popup 主题四态」过期

> **处置（security-reviewer，2026-09-12）：** 已修复 — 弹窗行改为「主题七态、字号、KaTeX/Mermaid 开关」。
- 位置：`docs/codebase_analysis.zh-CN.md:87`
- 证据：原文「popup/…弹窗：主题四态、字号、KaTeX/Mermaid 开关」；实际 `src/popup/App.vue:23` 主题循环为 7 态（auto/light/sepia/verdant/dark/nordic/dracula）。
- 建议修订文本：「弹窗：主题七态、字号、KaTeX/Mermaid 开关」。

### F-09 [P2] codebase_analysis 测试数量过期（34/逐模块数字均不准）

> **处置（security-reviewer，2026-09-12）：** 已修复 — 表格与总数按当前代码更新：directory 8 / dommd 22 / outline 5 / slug 4 / palette 4 / stats 2，合计 **45**（含本批 wasm 修复新增的 8 个边界测试），架构图同步改「45 个单元测试」，并加「以 `cargo test` 实时输出为准」避免再次硬编码过期。
- 位置：`docs/codebase_analysis.zh-CN.md:31`（“34 个单元测试”）、`:102-107`（模块单测数 8/11/4/3/5/2，合计 33，与总数 34 自相矛盾）、`:109`
- 证据：实际 `#[test]` 计数：directory.rs 7、dommd.rs 16、outline.rs 4、slug.rs 4、palette.rs 4、stats.rs 2，合计 **37**（无 tests/ 目录、无 #[ignore]）。文档表格逐模块数字与总数均与代码不符。
- 建议修订文本：架构图中改「37 个单元测试」；表格单测列改为 7/16/4/4/4/2，合计行改「合计 37 个 `cargo test` 单测」。另建议文档避免硬编码易变计数，改用「见 `cargo test` 输出」类表述。

### F-10 [P2] codebase_analysis 称 `_locales` 为“9 语言”，实际 8 个

> **处置（security-reviewer，2026-09-12）：** 已修复 — 改为「en/en_GB/en_US/zh_CN/zh_TW/ja/ko/uk 共 8 语言的描述与命令文案（en 为 default_locale）」。
- 位置：`docs/codebase_analysis.zh-CN.md:124`
- 证据：`public/_locales/` 实有 en、en_GB、en_US、ja、ko、uk、zh_CN、zh_TW 共 8 个目录。
- 建议修订文本：「en/en_GB/en_US/zh_CN/zh_TW/ja/ko/uk 共 8 语言的描述与命令文案（en 为 default_locale）」。

### F-11 [P2] codebase_analysis 将「Markdown 下载」归于 core/export.ts，实现实际在 App.vue

> **处置（security-reviewer，2026-09-12）：** 已修复 — export.ts 行改为「富文本复制（微信/知乎内联样式）、单文件 HTML 导出模板」；App.vue 行职责补「Markdown 原文下载」。
- 位置：`docs/codebase_analysis.zh-CN.md:58`
- 证据：`core/export.ts` 仅导出 `copyAsRichText`（富文本复制）与 `exportAsStandaloneHtml`（单文件 HTML 导出下载）；Markdown 下载实现在 `src/content/App.vue:461` 附近（`Blob(text/markdown)` + 触发下载，提示「已成功下载 Markdown 文件」）。功能存在，但职责归属写错。
- 建议修订文本：export.ts 行改为「富文本复制（微信/知乎内联样式）、单文件 HTML 导出模板」；App.vue 行的职责补「Markdown 原文下载」。

### F-12 [P2] codebase_analysis “辅助目录”一节列出已不存在的 `.trellis/`、`.agents/`

> **处置（security-reviewer，2026-09-12）：** 已修复 — 删除 `.trellis/`、`.agents/` 两行；`.codex/` 与 `reference/` 标注「被 .gitignore 忽略，仅存在于部分本地环境」。
- 位置：`docs/codebase_analysis.zh-CN.md:142-144`
- 证据：磁盘上无 `.trellis/`、`.agents/` 目录（`.codex/` 存在但被 .gitignore 忽略；`reference/` 亦被忽略）。文档将其描述为仓库辅助目录，新克隆者无法对应，且 Trellis 工作流约定细节已无实体。
- 建议修订文本：删除 `.trellis/`、`.agents/` 相关行，或改为「以下目录被 .gitignore 忽略、仅存在于部分本地环境：`.codex/`（本地 agent 配置）、`reference/`（外部参考资料归档）」。

### F-13 [P2] wasm_core 中英对一处措辞不一致："scoring" vs “统计”

> **处置（security-reviewer，2026-09-12）：** 已修复 — EN 改为 "parsing, filtering, mapping, statistics, serialization"，与 ZH「统计」及代码事实（`doc_stats`）对齐。
- 位置：`docs/wasm_core.md:30`（“parsing, filtering, mapping, scoring, serialization”）对照 `docs/wasm_core.zh-CN.md:27-28`（“解析、过滤、映射、统计、序列化”）
- 证据：Rust 侧对应能力是 `doc_stats`（统计），并无 scoring 逻辑；两文本应同源同义。
- 建议修订文本：EN 改为 "parsing, filtering, mapping, statistics, serialization"。

### F-14 [P3] SECURITY 双语未给出具体安全联系方式

> **处置（security-reviewer，2026-09-12）：** 未修（P3，不在本次 t4 修复范围 F-01..F-13/F-15/F-17 内）。
- 位置：`SECURITY.md:3`、`SECURITY_zh.md:3`
- 证据：仅写“通过 GitHub 组织账号或本仓库配置的安全联系方式私下联系”，全仓库无任何具体邮箱/PRIVATE vulnerability reporting 入口说明，报告者无从下手。
- 建议修订文本：补充具体渠道，如「请使用 GitHub 的 Private vulnerability reporting（Security 标签页 → Report a vulnerability）或邮件 security@<域名>」。

### F-15 [P3] codebase_analysis「shared/ 与其余 UI 面」分节标题与组件实际路径不符

> **处置（security-reviewer，2026-09-12）：** 已修复 — 分节标题改为「shared/、components/ 与其余 UI 面」，四个组件行路径标注为 `src/components/…` 并注明与 shared/ 不同目录。
- 位置：`docs/codebase_analysis.zh-CN.md:77-86`
- 证据：`CustomSelect.vue`、`IconButton.vue`、`SvgIcon.vue`、`icons/IconLogo.vue` 实际位于 `src/components/`（`src/shared/` 仅 constants/i18n/storage/types），但被排在以 "shared/" 开头的分节内，易误读为 `src/shared/components/`。
- 建议修订文本：将该分节拆为「shared/」与「components/（通用组件）」两个小节，或把四个组件行的路径标注为 `src/components/…`。

### F-16 [P3] rendering_review 参考链接使用 http

> **处置（security-reviewer，2026-09-12）：** 未修（P3，不在本次 t4 修复范围 F-01..F-13/F-15/F-17 内）。
- 位置：`docs/rendering_review.zh-CN.md:46`（`http://theme.typora.io/`）
- 证据：链接可用（本次探测 200），但站点支持 https，正式文档应统一 https。
- 建议修订文本：改为 `https://theme.typora.io/`。

### F-17 [P3] README 文档索引未收录 performance 中文版与 rendering_review

> **处置（security-reviewer，2026-09-12）：** 已修复 — EN README Documentation 补 `[Performance notes (中文)]` 与 `[Rendering review (中文)]`；ZH 索引已随 F-04 一并对齐。
- 位置：`README.md:33-38`
- 证据：`docs/performance_optimization.zh-CN.md`、`docs/rendering_review.zh-CN.md` 已存在但 EN README 文档索引未列出（codebase_analysis 同样只在 ZH 索引外）。
- 建议修订文本：Documentation 列表补 `[Performance notes (中文)](docs/performance_optimization.zh-CN.md)` 与 `[Rendering review (中文)](docs/rendering_review.zh-CN.md)`，或在 F-04 补齐 ZH 索引时一并对齐。

---

## 三、中英文档逐对结论

| 文档对 | 结论 | 备注 |
|---|---|---|
| README.md ↔ README_zh.md | **部分不一致（F-04、F-05）** | 主体功能描述语义一致；ZH 缺 native-host 章节与文档索引，EN 用 npm、ZH 未说明 wasm-pack |
| CONTRIBUTING.md ↔ CONTRIBUTING_zh.md | 一致 | 语义逐句对应；但两版同错引用 `resources:test`（F-02） |
| SECURITY.md ↔ SECURITY_zh.md | 一致 | 语义一致；同有“联系方式不具体”问题（F-14） |
| CODE_OF_CONDUCT.md ↔ CODE_OF_CONDUCT_zh.md | 一致 | 三段逐句对应，无偏差 |
| docs/wasm_core.md ↔ wasm_core.zh-CN.md | 基本一致 | 模块清单/契约/构建/体积逐条对应，仅 "scoring"/“统计” 一词之差（F-13） |
| docs/performance_optimization.md ↔ .zh-CN.md | 一致 | 范围、运行时行为（30s 缓存、回退、Git 忽略）、基准数字、构建命令逐条对应且与代码相符 |
| .github/pull_request_template.md ↔ _zh.md | 一致 | 段落与检查项一一对应；`pnpm run build` 为真实存在的脚本 |

---

## 四、文档 ↔ 代码逐项核对结果（通过项）

以下文档断言已逐一与代码核对，全部相符：

**构建 / 安装**
- `package.json` scripts：`dev`（build.mjs --watch）、`build:wasm`（build_wasm.mjs）、`build`（build:wasm + build.mjs）；README/CONTRIBUTING/PR 模板中 `npm run build`、`pnpm run build` 指向的流程真实存在（除 F-02 的 resources:test）。
- `scripts/build_wasm.mjs`：`wasm-pack build --target web --release --out-dir src/content/wasm` ✓（wasm_core.md 构建注释相符）。
- `scripts/build.mjs`：popup/options HTML 入口 → 内容脚本 IIFE `content/index.global.js` → background ESM → 拷贝 manifest/_locales/assets → 内容脚本 `\uXXXX` ASCII 转义 → 递归 chmod → watch 200ms 防抖 ✓（codebase_analysis 第四节相符）。
- `dist/content/wasm/markdown_analyzer_bg.wasm` 实测 153,143 B ≈ 150 KB，与 wasm_core.md “经 wasm-opt 后约 150 KB” 相符；`markdown_analyzer.js` glue 存在 ✓。
- `src/content/wasm/`、`wasm/**/target/`、`native-host/**/target/` 均在 .gitignore ✓（performance 文档相符）。

**manifest / 权限 / 快捷键 / 描述**
- content_scripts matches 覆盖 md/mdx/mdc/mkd/markdown（含大写与 query 串）+ `file:///*` ✓（README “Read Markdown, MDX, MDC, MKD, and MARKDOWN” 相符）。
- `web_accessible_resources` 放行 `assets/*`、`content/wasm/*` ✓（wasm_core.md 相符）。
- 4 个 commands：toggleCentered(Alt+Shift+C)/togglePageTheme(Alt+Shift+T)/toggleRefresh(Alt+Shift+R)/toggleSide(Alt+Shift+B)，与 codebase_analysis “4 个快捷键命令” 相符 ✓（权限清单不符处见 F-03）。
- manifest `description` 为 `__MSG_ext_desc__`，default_locale=en，en 描述与 package.json description 一致 ✓（多语言包漂移见 F-01）。

**WASM 核心**
- `wasm/markdown_analyzer/src/lib.rs` 恰好 8 个 `#[wasm_bindgen]` 导出：parse_directory / filter_directory / scan_directory / ancestor_folder_urls / build_outline / search_palette / dom_to_markdown / doc_stats ✓（wasm_core.md 模块清单、codebase_analysis “8 个导出函数” 相符；测试数不符见 F-09）。
- `build_outline(headings: JsValue, max_level: i32)` 使用 i32 ✓；`palette.rs` 含 `#[serde(rename = "isFolder", default)]` ✓（两文档“工程约束”描述相符）。
- 加载器 `core/wasm_analyzer.ts` 经 `chrome.runtime.getURL('content/wasm/markdown_analyzer.js')` 动态加载、单例缓存 ✓。

**功能行为**
- 目录 HTML 30s 缓存 + 并发复用 in-flight promise：`folder.ts` `DIRECTORY_CACHE_TTL_MS = 30_000` ✓。
- 文档统计：`doc-stats.ts` `Math.max(1, Math.ceil(words / 400))`（400 字/分钟、最小 1）✓。
- ⌘K 面板限额 12/16：`palette.ts` `EMPTY_QUERY_LIMIT = 12` / `FILTERED_LIMIT = 16` ✓。
- `[TOC]` 支持：`markdown.ts` tocPlugin 占位容器 + `isEnabled('TOC')` 插件开关 ✓（rendering_review 相符）。
- 标题锚点悬停 `#`、点击复制 `URL#slug`：`enhancements.ts` `.mdr-heading-anchor` ✓。
- 深色主题代码高亮适配（nordic/dracula 等 `data-mdr-theme` hljs 覆盖）✓（rendering_review 相符；主题总数过期见 F-07/F-08）。
- 保存管线：`App.vue saveInPlace`（目录句柄静默覆盖 → 首次目录授权 `create:false` → `showSaveFilePicker` 单文件兜底）+ `file-handle-storage.ts` 逐级下钻 `create:false` ✓。
- Native Messaging 静默保存：`native-save.ts` 经 background 中继 `connectNative('com.markcraft.filewriter')`、超时回退 ✓；宿主 `main.rs` 仅接受绝对路径、`is_file()` 校验目标必须已存在、同目录临时文件 + 原子 rename、响应 `{"ok":true}` / `{"ok":false,"error"}` ✓（native-host/README 协议与安全设计逐条相符）。
- `install.sh`：cargo build --release、未打包扩展 ID = 目录绝对路径 SHA-256 前 32 位 0-9a-f→a-p、写入 macOS/Linux NativeMessagingHosts、allowed_origins 锁定扩展 ID、Windows 提示写注册表 ✓（native-host/README 安装章节相符）。
- `ActionBar.vue` 未被 App.vue 挂载（保留备用）✓；`InPlaceFormattingToolbar.vue` 使用 execCommand ✓；`background/index.ts` 含 bg-fetch 代理 / native-save 中继 / open-options-page / commands 转发 ✓；`Side.vue` sessionStorage 工作区根 + pushState ✓；`index.ts` 准入闸门（后缀 + Content-Type + `<pre>` 启发式、挂载 `#mdr-root`）✓；`storage.ts` normalizeSettings 兼容 mdPlugins 字符串/数组 ✓；`style.css` 实测 976,144 B（“976KB” 相符）✓；UI 组件挂 `print:hidden` ✓（rendering_review 相符）。
- 根目录无 LICENSE 文件，与 README “尚未授予再分发许可、首次公开发布前补充” 的说法自洽 ✓。

**链接检查**
- README/CONTRIBUTING/PR 模板内部链接（README_zh.md、docs/*.md、SECURITY.md）目标文件均存在 ✓。
- rendering_review 8 个外部链接逐一探测全部返回 200（含 github.github.com/gfm、docs.github.com、theme.typora.io、madmaxchow.github.io/VLOOK、mdit-plugins.github.io、markdown-it-katex、draculatheme.com/spec、nordtheme.com），无死链（仅 F-16 的 http→https 建议）。

---

## 五、修复优先级建议

1. **立即**（F-01、F-02、F-03）：六语言包品牌对齐 en；删除/补齐 `resources:test`；更正权限描述。三者均为用户或贡献者可直接感知的错误。
2. **随下一批提交**（F-04 ~ F-12）：README 双语对齐与 pnpm 口径统一；pnpm-workspace.yaml 修正；codebase_analysis 各过期数字/清单更新（或改为不易过时的表述）。
3. **择机**（F-13 ~ F-17）：措辞统一、联系方式具体化、路径标注与链接协议修正。
