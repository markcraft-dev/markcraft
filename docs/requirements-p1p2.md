# MarkCraft P1/P2 需求与开发设计（Requirements + Dev Design）

> 配套：`docs/product-plan.md`（路线）／`docs/competitor-deepdive.md`（§C 未解痛点、§D 铁律）。
> 约定：`[manual]` = 需用户 Chrome 真机终验；估算单位 = S（≤1 天）/M（2–3 天）/L（≥4 天，须再拆）。
> 现状引用均为本轮基线（含 t1–t7 六枚 commit 之后的代码）。

---

## R0. 渲染消毒链（安全，N3，P1 内最高优）

- **背景/目标**：Markdown Reader 用 DOMPurify 全量消毒；我们经 markdown-it → `v-html` 直渲染（`src/content/App.vue:56-64`），t4 审计仅注记 CSS `@import` 外联风险。目标：渲染与导出链统一消毒，零新增外联。
- **非目标**：CSP 改动（MV3 content-script 上下文复杂，另议）。
- **用户故事**：作为读者，打开不可信 md（含 `<script>`/`<img onerror>`/`@import`）时，页面不执行、不外联。
- **验收**
  1. `reference/fixtures/xss.md`（抄 Reader 的 `test.md` §6：`<script>alert`、onerror、`javascript:` 链接、`@import` style）渲染后：无弹窗、无网络外联请求（devtools `[manual]`）、恶意节点被剥离（DOM 断言）。
  2. 导出 HTML（R1）同样过消毒；KaTeX/Mermaid 正常渲染不受影响（现有文档回归）。
   ✅ T9 已做 export 链份额：`sanitize.ts` 新建并接入导出入口（`buildStandaloneHtmlDocument` 必经 `sanitizeHtml`）；渲染链与 R7 接入不在本任务（T15 验收时覆盖）。
- **现状差距**：`markdown.ts` 无消毒步骤；`export.ts:exportAsStandaloneHtml` 直接拼 `renderedHtml`。
- **技术方案**
  1. 新增 `src/content/core/sanitize.ts`：`sanitizeHtml(html): string`（自研轻量 allowlist：禁 `script/iframe/object/embed`、禁 `on*` 属性、禁 `javascript:`/`data:text/html` URL、剥 `<style>` 内 `@import`；Mermaid 输出的 `<svg>` 保留但剥事件属性）。
     - 注：是否引入 DOMPurify 依赖由实现者定：若自研 allowlist 能覆盖验收 fixture 则不引（保持零依赖哲学）；否则 `pnpm add dompurify` + 类型声明（CI 要过 `tsc`）。
  2. 接入点：`App.vue` 渲染赋值处包一层；`exportAsStandaloneHtml` 入口包一层；搜索摘要（R7）渲染前包一层。
- **风险**：Mermaid/KaTeX 输出被误杀 → 用现有文档全量回归 + fixture 覆盖。
- **测试**：fixture 断言 + 回归现有渲染；`[manual]` 外联检查。
- **估算**：M。**Phase-2 任务**：与 R1 同人顺手做（export 链）或独立，见任务拆分。

## R1. P1-2 导出加固：离线单文件 HTML + 打印 CSS（U7）

- **背景/目标**：MPP 只做到“能导出 HTML”；MarkView 做到“Base64 图 + 内联 CSS 真离线”。我们 `exportAsStandaloneHtml`（`export.ts:77-141`）现状：有内联排版 CSS，但**相对/远端图片不内联、KaTeX CSS 不内联、Mermaid 靠序列化 DOM 残留、无 `@media print`**。目标：真离线单文件 + 打印不裁代码块。
- **非目标**：DOCX（重，明确不做）、PDF 引擎（用打印 CSS 走系统打印，不自研）。
- **用户故事**：技术作者导出后发同事，对方断网打开，Mermaid/公式/表格/代码与屏上一致；打印/PDF 无黑边裁切。
- **验收**
  - [x] 1. 三 fixture（`export-mermaid.md` / `export-katex.md` / `export-table-code.md`，`reference/fixtures/` ✅ T9 已建）：断网打开导出文件，像素级一致（`[manual]` 目检 + DOM 结构断言：`img[src^=data:]` 全覆盖、`.katex` 样式生效）。实现：live-element 导出（Mermaid SVG 序列化保留）+ KaTeX CSS `?raw` 内联；`[manual]` 目检待 T15。
  - [x] 2. 图片内联失败（跨域/CORS）时降级保留原 URL + console warn，不阻断导出（✅ T9：`inlineImagesInto` 全路径 try/catch + 16MB 超限降级；纯函数断言见 `npm run test:unit`，fetch 降级分支走代码走查 + T15 `[manual]`）。
  - [x] 3. `@media print`（✅ T9：导出模板内嵌打印 CSS + `markdown.css` 屏上打印规则 `pre/table` 不截断、chrome 隐藏；A4 三 fixture `[manual]` 待 T15）。
  - [x] 4. 标题注入回归：`</title><script>` 标题仍被转义（✅ T9：`escapeHtml` 迁入 `sanitize.ts` 并单测化，见上）。
- **现状差距**：见上；另图片 `max-width:100%` 有、无圆角（`export.ts:120`）与屏上 lightbox 语义不一致，可接受。
- **技术方案**
  1. `export.ts` 新增 `inlineImages(clone, baseHref)`：遍历 `img`，`fetch → blob → dataURL`（经 bg-fetch 复用 CORS 路径？content 侧直 fetch 失败则 warn 降级；注意 `file://` 相对图用 `fetchDocContent` 思路解析，失败降级）。
  2. 内联 KaTeX CSS：将 `katex/dist/katex.min.css` 读入构建（`?inline` 或 scripts/build.mjs 复制，**不手写 CSS**），Mermaid SVG 已是行内 DOM 直接保留。
  3. 打印 CSS 追加到导出模板 + `content/style.css`（屏上打印同样隐藏 chrome）。
  4. 文件变更：仅 `export.ts`（+ 构建脚本若需内联 css）+ `reference/fixtures/export-*` + 本验收表打勾。
      ✅ T9 实际变更：`export.ts`（独占）、新建 `sanitize.ts`（R0 export 链份）、`App.vue` 仅导出入口一行调用切换、`shims.d.ts` 加 `*?raw` 声明（KaTeX CSS 用 `?raw` 内联，构建脚本零改动）、`markdown.css` 追加屏上打印规则（`src styles/style.css` 经查无人引入，未动）、`tests/export-sanitize.test.mjs` 零依赖单测（已接入 `npm run test:unit`）、`package.json` test:unit 编译目标扩展、`reference/fixtures/export-*` 三件套。
- **风险**：大图 Base64 体积（16MB 上限呼应 t5 bg-fetch cap，超限降级）；`file://` 读图 CORS（降级路径必须可用）。
- **测试**：三 fixture + 降级用例 + 现有构建/类型门禁。
- **估算**：M。**Phase-2 首批**。

## R2. P1-3 新手引导：file-URL 引导卡 + 60s tour + 存回 nudge（U1/U5）

- **背景/目标**：U1 是全品类通病（Reader/MarkView/MPP 全靠用户自己找到开关）；我们 P0-4 只剩“可发现性”。目标：新用户 60 秒内完成“开开关 → 读文档 → 知道能存回”。
- **非目标**：多语言引导（中文先行，N4 另排）；自动检测开关状态的黑科技（Chrome 不暴露 API，用启发式：`isLocal && folderTree empty && 无 failure` → 展示引导卡，不误伤真空目录——需与 t2 的 failure/empty 三态联动）。
- **用户故事**：macOS 双击 md → 看到引导卡 → 点链接跳 `chrome://extensions` 开开关 → 回来即读；tour 气泡依次点亮 palette/大纲/编辑/保存。
- **验收**
  1. Fresh profile（`[manual]`）：`file://` 无开关态显示引导卡（含icago：为什么、去哪开、在线文档不受影响）；有开关态不打扰。
  2. tour 可跳过、<60s 走完四站、不污染滚动记忆（tour 不触发 scroll save）。
  3. 存回 nudge：首次点保存且无 handle 授权时，提示 native-host 免弹窗选项（`native-host/README.md` 链接），可永久关闭。
- **现状差距**：无引导组件；`Side.vue` 空态只有“未找到 Markdown 文件”（t2 后有 failure/empty 区分，需再加第三态 `noFileAccess`）。
- **技术方案**
  1. 新增 `src/content/components/OnboardingCard.vue`（引导卡）+ `TourBubble.vue`（极简 tour，两处用 `chrome.storage.local` 记 `seen`）。
  2. `Side.vue` 空态三改四：loading / failure / genuinely-empty / **noFileAccess(启发式)**；`App.vue` tour 编排（复用现有 toast/快捷键位）。
  3. 文案中英双语写死（`_locales` manifest 串复用，应用内硬编码 zh+en，不搭 i18n 框架——N4 另议）。
- **风险**：启发式误判（真空目录被当成没开开关）→ 文案必须写“如果你确认开过开关请忽略”，且提供“不再提示”。
- **测试**：三态快照断言 + `[manual]` fresh profile。
- **估算**：M。**Phase-2 首批**。

## R3. P1-4 富文本粘贴保真（U9，三靶：微信/知乎/Notion）

- **背景/目标**：CN 内容运营刚需；我们 `copyAsRichText`（`export.ts:8-65`）已有内联样式，但**保真度从未验证**，且图片/Mermaid/公式是裸奔状态。
- **非目标**：公式完美粘贴（各家都做不到；输出“降级说明”即达标）。
- **用户故事**：运营从 MarkCraft 复制一节文档，粘进微信公众号/知乎/Notion，标题列表表格代码齐整；公式变成源码文本 + 一句提示，不乱码。
- **验收**：fixture `copy-fidelity.md`（✅ T10 已建，`reference/fixtures/`：标题/表/代码/公式/图/任务列表）→ 三靶 `[manual]` 目检（待 T15）：标题+列表+表格不断裂；代码块保留等宽底色；公式降级为 `$...$` 文本；图片注明“需另传”（微信外链图必然挂——诚实比假装支持重要）。实现（✅ T10，同文件串行于 T9 之后）：clone 流水线加三步：① `.katex-display`/`.katex` → `$$源码$$`/`$源码$`（mathml annotation 优先，渲染文本兜底）；② 含 svg 的 `.mdr-mermaid-block`（+ 游离已渲染 svg 防御）→ 虚线占位说明，未渲染源码文本原样保留；③ `img` 缩略图样式 + 尾注“N 张图片需另传”。
- **现状差距**：`copyAsRichText` 无 Mermaid（SVG 粘贴必挂）、无 KaTeX 降级、无图注；异常只 fallback 纯文本。
- **技术方案**：clone 流水线加三步：① `.katex` → 文本 `$源码$`；② `svg.mermaid` → 占位“[图：Mermaid，需截图]”；③ `img` → 保留 thumbnail + 尾注“图片需在目标编辑器另传”。文件变更仅 `export.ts`（与 R1 同人同文件，**串行**）。
- **风险**：各靶编辑器行为漂移 → fixture + 截图留档，接受“版本快照”式验收。
- **估算**：S。**Phase-2，排在 R1 之后同人**。

## R4. 粘贴路径容错 N6（顺手，doc-url 扩展）

- **目标**：`parseDocUrl`（`doc-url.ts:78`）加 trailing-junk 剥离：`)`、`）`、`>`、`"`、`.`、`。`、`!` 等，剥后 `fetchDocContent` 重试一次；正常路径零触碰。
- **验收**：单测 8 条（含中文括号、中英文句号、正常路径不受影响）；`[manual]` 聊天复制路径。
- **估算**：S。**Phase-2，R2 同人顺手**（都是 URL/引导链）。

## R5. RAW 源码切换 N1（MarkView 对标，极便宜）

- **目标**：快捷键 + 按钮在渲染/`pre` 源文本间瞬切（复用现有 `rawMarkdownContent`，t3 后 App 已持有），不经过重 fetch；切换保滚动（调 scroll-memory 同 key 恢复）。
- **验收**：大文档（1MB）切换 <100ms（不断言精确值，断言无 fetch 发生：spy `fetchDocContent`）；快捷键不与浏览器冲突（备选 Ctrl/Cmd+Shift+M，检查 manifest commands 占用）。
- **估算**：S。**Phase-2 任一前端顺手**。

## R6. 最近文档 N2（MarkView/Obsidian 对标，便宜）

- **目标**：`chrome.storage.local` 存最近 20（复用 `normalizeScrollKey` 做 key，含 title + mtime + scrollY 快照）；Side 顶部“最近”分组 + palette 置顶。
- **验收**：A→B→C 后最近列表顺序正确；配额爆时 LRU 淘汰（单测）；清数据不影响阅读。
- **估算**：S。**Phase-2，R9（进度 v2）前置**（共用存储 shape，先定 schema）。

## R7. P2-1 文件夹全文检索（U10，WASM 索引）

- **背景/目标**：palette 现状仅文件名+标题（`palette.ts:searchPalette(files, headings, q)`）；Obsidian/Logseq 把全文检索拉成标配。目标：200 文件 ≤300ms 出 ranked hits（标题加权 > 正文），snippet + 标题上下文，纯本地。
- **非目标**：模糊拼音（先精确+前缀；拼音是二期优化项）；远端 URL 全文（先本地）。
- **验收**：200 文件 fixture（脚本生成）检索 P95 ≤300ms；snippet 高亮转义（过 R0 消毒）；`file://` 友好（经 bg-fetch，不直 fetch）；空结果态。
- **现状差距**：无索引层；WASM 侧有 `markdown_analyzer`（`build_outline` 已用），可加 `build_index` Rust 函数（wasm 目录 `wasm/markdown_analyzer`，t5 已加 cargo test 门禁，顺势加单测）。
- **技术方案（二选一，实现者定）**
  - A（推荐）：Rust WASM 倒排（内存 residents，lazy 建索引，防抖增量）；JS 侧 `src/content/core/search-index.ts` 封装 + palette UI 加 “全文” tab。
  - B：JS 侧 mini 实现（中文分词用二元切分，不引库）。200 文件内 B 够用，但 WASM 是我们的既定架构，选 A。
- **风险**：索引内存（大文件截断 200KB/文件，先行）；构建链 wasm-pack（CI 已有）。
- **估算**：L（拆：索引 M + UI S）。**Phase-2 首批（auditor，WASM 熟）**。

## R8. P2-2 章节锚链（Logseq/GitHub 对标）

- **目标**：每标题 hover 锚（`#slug`，规则文档化并与 WASM `build_outline` 同源），“复制章节链接”经 doc-url hash（`#mdr-doc=<doc>#<slug>` 双 hash 设计要小心——改用 `?mdr-doc=` 或单 hash 拼接，实现者定，t3 遗留）；打开链接直达章节（渲染后重试滚动，复用 scroll-memory 的 retry 机制）。
- **验收**：slug 单测 15 条（含中文/emoji/重复标题 `-1` 后缀）；跨重渲染稳定（Mermaid 重渲染后仍命中）；分享链接 `[manual]`。
- **估算**：M。**Phase-2（t3 同人 nav-engineer，R2 之后串行，同改 App/Side）**。

## R9. P2-3 阅读进度 v2（U3 延伸，R6 的 schema 复用）

- **目标**：TopHeader 现有 `readingProgress` 条 → 补 % 数字；文件夹树 resume badge（“读到 62%”）；“继续阅读”一键回位（读 scroll-memory 快照）；数据全在 `chrome.storage.local`。
- **验收**：A 读到 60% → 切 B → 回 A 落点 ±24px（与 P0-1 同标）；badge 不闪烁（防抖写，复用 `scheduleSaveScrollPosition` 节奏）。
- **估算**：M。**Phase-2（R6 同人/后串行）**。

## R10. 横向：fixture 方法论 + P2-4/P2-5 简述

- **Fixture（R9 的 R，P1 内）**：`reference/fixtures/*.md` + 每功能验收表打勾；`xss.md`、`export-*`、`copy-fidelity.md`、`viewer-test.md`（抄 mdview Safe Test File 四件套：任务列表+表格+行内公式+Mermaid）。
- **P2-4 大文档性能**：Mermaid/KaTeX 渐进渲染、大纲虚拟化、图片懒加载；1MB fixture 首绘 ≤2s（参考机留档）。**不进 Phase-2，进 Phase-3**。
- **P2-5 主题包**：打印主题 + CN 字体栈 + WCAG AA 对比度审计。**不进 Phase-2，进 Phase-3**。
- **测试约定（unit）**：`npm run test:unit` = tsc 单文件编译到 `tests/.tmp` + `node --test`，零新依赖。
  - 被测模块须是无本地导入的叶子模块；跨模块复用（如 `recents.ts` 用 `scroll-memory.ts` 的 `normalizeScrollKey`）时，源码须写 `.js` 后缀 import（`./scroll-memory.js`），否则 Node ESM 解析失败（Vite 构建侧已验证兼容）。
  - 新模块按此接线：tsc 输入与 `.test.mjs` 一并追加到 `test:unit` 脚本。

## Phase-2 任务拆分（给团队用，依赖已排好）

| 任务 | 内容 | 人 | 依赖 | 估算 |
|---|---|---|---|---|
| T9 | R1 导出加固 + R0 消毒链（export 链份） | scroll-engineer | — | M |
| T10 | R3 粘贴保真（同文件串行） | scroll-engineer | T9 | S |
| T11 | R2 新手引导 + R4 路径容错 + R5 RAW | nav-engineer | — | M |
| T12 | R8 章节锚链 | nav-engineer | T11 | M |
| T13 | R7 全文检索（WASM 索引 + palette 全文 tab） | auditor | — | L |
| T14 | R6 最近文档 schema + R9 进度 v2 | auditor | T12（Side 徽标避冲突） | M |
| T15 | R10 fixtures + 全功能验收执行（含 `[manual]` 清单输出） | researcher | T10,T12,T13,T14 | M |
| T16 | Phase-2 门禁（t8 同规 + 待推送清单，不推送） | integrator | T15 | S |
| 非目标 | P2-4、P2-5、DOCX、演示模式、外链预览卡 | — | Phase-3 | — |
