# MarkCraft 竞品深掘（Competitor Deep Dive）

> 作者：captain 综合 t6 调研 + Firecrawl 全文抓取（2026-09-19）
> 配套文档：`docs/product-plan.md`（矩阵与路线）／`docs/requirements-p1p2.md`（需求+开发设计）
> 方法说明：凡标注 **[高]** 为一手来源（官方仓库 README、官方文档、实测抓取全文）；
> **[中]** 为第三方横评或社区讨论；**[低]** 为厂商自有宣传页（默认打折采信），已在文中注明。
> 本次新增一手来源：`getmarkview.com/blog/best-markdown-viewers`（MarkView 自营博客，**立场偏向，数据可用、排名不可用**）、
> `github.com/volca/markdown-preview`（MPP 官方仓库全文）、`github.com/shawnmuggle/markdown-reader`（官方仓库全文）、
> `mdview.io/s/markdown-viewer-browser-extension`（在线阅读器官方指南）、MarkCraft 自身源码（`src/`，最高优先级）。

---

## A. 直接竞品（浏览器扩展）

### A1. Markdown Viewer（simov）——装机量最大的经典款 [中]

- **定位**：最老牌的“打开即渲染”极简阅读器，10 万+ 用户，口碑来自稳定而不是功能。
- **长处**
  1. 简单：零学习成本，打开 `.md` 即是 GitHub 风排版；性能好，巨文档也不折腾。
  2. 信任资产：多年不折腾 + 大用户基数，新用户默认首选；自定义 CSS 开口子，极客可自救。
  3. TOC 大纲 + 明/暗主题，覆盖 80% 阅读场景。
- **短处**
  1. 纯查看：无编辑、无存回、无导出、无文件夹、无自动重载（U5/U6/U7 全空）。
  2. 迭代停滞感：UX 停留在 2015 年代；有横评称其“按文件配主题”入口绕（此条为竞品之口，**[低]**，不直接采信，但“设置要全局简单”是可借鉴的结论）。
  3. 与 MarkCraft 的 P0 同类问题同样存在（切换无记忆、无 URL 同步概念）。
- **尚未解决的用户痛点**：U1（file-URL 开关难找，各家通病）、U3、U4、U6、U7。
- **可借鉴清单**
  - 自定义 CSS 的“高级但藏起来”的做法：默认简单，进阶入口折叠（我们已有 `enableCustomCSS`，交互可对标其克制）。
  - TOC 生成的 heading slug 规则应当文档化（关联 P2-2）。

### A2. Markdown Preview Plus（volca/MPP）——开发者向，**开源可读源码** [高]

官方仓库（252 stars / 73 forks / MIT，2026-06 仍在提交，含 `test/` 目录）：

- **功能实测清单**：auto reload、external CSS、**per-file theme**、GFM、export HTML、KaTeX **+ MathJax 双引擎**、Mermaid、URL 参数。
- **长处**
  1. **自动重载是其口碑最好的功能**（多篇横评一致）——验证了我们 P1-1（t7 已交付）的方向；它的实现是“轮询派”，与我们的 `doc-watcher.ts`（1.5s bg-fetch 轮询）同构，可互相对照调参。
  2. **导出 HTML** 是用户第二买单点——验证 P1-2 的优先级；注意它只做 HTML，不管离线资源内联。
  3. 开源：它的 `js/` 实现、per-file 配置模型、KaTeX 与 Markdown 定界符冲突处理（`$` 冲突用选项开关）是现成的反面/正面教材。
  4. 数学兼容性做到极致（KaTeX+MathJax 双引擎 + ` ```math ` 代码块），学术用户的基本盘。
- **短处**
  1. UI 停留在 bootstrap 年代；per-file 主题 = 配置复杂度爆炸（我们的教训：坚持全局主题，**不抄 per-file**）。
  2. 解析器是 Marked（老）而非 markdown-it 生态，插件能力弱于我们。
  3. 无文件夹导航、无编辑存回、无搜索、无 URL 同步；Marked + 数学字符串有过冻结 bug（2026-06 刚修过 inline-math freeze，见其 commit）。
- **尚未解决的用户痛点**：U2（无文件夹概念）、U3、U4、U5、U9、U10。
- **可借鉴清单（按优先级）**
  1. KaTeX 定界符冲突选项（`$` 误触是中文技术文档高频 complaint；我们的 `markdown.ts` 应加一条用例 + 可选开关）→ 记入 P2-4/可靠性 backlog。
  2. 导出 HTML 的“最小可用”形态（先对齐它，再超越它：内联图片 + 内联 KaTeX CSS，见 P1-2）。
  3. `test/` 目录方法论：每个 fixture 对应一条用户故事（我们应建 `reference/fixtures/*.md` + 渲染断言，见 §D）。

### A3. Markdown Reader（shawnmuggle）——**最接近 MarkCraft 哲学的新人** [高]

官方仓库全文（7 commits / 0 stars / MIT / 零构建 MV3，2026-08 活跃）：

- **功能实测清单**：拖拽/`file://` 直渲染、GitHub 排版、侧栏大纲 + scroll-spy、**文件夹浏览**（`file:///dir/` 美化 + 面包屑 + 回上级）、**同目录兄弟文件导航**（当前高亮）、**粘贴路径容错**（自动剥 `…md)`、`…md）` 尾巴重试）、hljs、明/暗记忆、**中英双语 UI**、GFM 表格+任务列表+Mermaid、**DOMPurify 全量消毒**、全离线 vendored（marked/DOMPurify/hljs/mermaid/github-css 锁版本）、>1MB 的 `.txt` 降级纯文本、`test.md` 自检清单（含 XSS 条目）、`PRIVACY.md` 独立隐私声明。
- **长处**
  1. 哲学与我们几乎一致：本地优先、零后端、零遥测、权限只要 `storage`（我们是 `storage` + `nativeMessaging`，多了存回能力）。
  2. 细节嗅觉极好：兄弟文件导航（轻量版文件夹树）、粘贴路径容错（ IM/聊天复制场景）、双语 UI（CN 用户基本盘）、test.md 清单文化。
  3. **DOMPurify 是它相对我们最大的工程优势**：t4 审计 P2 已记“CSS `@import` 外联注记”——我们的 markdown-it 输出链目前没有系统化消毒，这是**安全债**，必须排期。
- **短处**
  1. 纯查看：无编辑存回（我们的护城河）、无导出、无搜索、无自动重载、无阅读记忆。
  2. 无文件夹树（只有兄弟文件 + 目录美化），200+ 文件项目不可用。
  3. 生态基本为零（无 star、无发行版、无商店页证据），持续维护风险高。
- **尚未解决的用户痛点**：U3、U4、U5、U6、U7、U9、U10（恰好是我们 P0+P1 的覆盖圈——**它是验证我们路线最好的对照组**）。
- **可借鉴清单（按优先级）**
  1. **DOMPurify 消毒链**（安全，P1 内必须做，见 requirements R0）。
  2. **粘贴路径容错**：我们的 `parseDocUrl`（`src/content/core/doc-url.ts:78`）应加 trailing-junk 剥离 + 重试（3 行正则量级，顺手做，记入 P1-3）。
  3. **test.md 清单文化**：每个功能一条可勾选验收（我们的 fixtures 采用，见 §D）。
  4. **中英双语 UI 框架**：我们 `_locales` 有 8 语言 manifest 字符串，但应用内 UI 全是中文（t4 P2 已记）。它的 `i18n.js` 极简模型（跟随浏览器 + 手动切换 + 持久化）是 P2 本地化的直接模板。
  5. 兄弟文件导航：我们已有完整文件夹树（超集），只需在空目录/单文件场景补一个轻量横条（低优先级）。

### A4. MarkView（markview-app，自营博客口中的“第一”）——功能清单供应商 [低]

> 立场声明：`getmarkview.com/blog/*` 是 MarkView 官方博客，“5/5、竞品 3/5”的打分**不可采信**；
> 但它的**功能清单是真实的**（与其商店页可互证），可作为“别人已经做到的天花板”来用。

- **功能清单（抓取实测）**：文件夹浏览器 + 文件夹书签 + 最近文档、字数/阅读时长、阅读进度条（含 100% 彩蛋）、外链预览卡（OpenGraph，缓存 7 天）、RAW 源码一键切换（Ctrl+Shift+M）、导出 HTML（含 Base64 图 + 内联 CSS）/DOCX（LaTeX→OMML 原生公式）/PDF（打印优化）、**演示模式**（`---`/H1H2 切页、全屏、自动播放）、图片灯箱画廊（滚轮缩放、手势、键盘）、Mermaid 交互缩放 + SVG/PNG/JPEG 导出、懒加载（号称首屏 -80%）、180+ 语言高亮 × 14 主题、9 字体、15 语言 UI、全离线零收集。
- **长处**：阅读器品类的功能天花板；“生产力小件”（字数、进度、RAW、最近文档）拼起来构成护城河；导出三件套是真实差异化。
- **短处**（相对我们）
  1. 依然是**纯查看**：无就地编辑、无存回（我们的 wedge 不变）。
  2. 同样要开 file-URL（U1 通病，谁也跑不掉——拼的是引导文案）。
  3. 营销页性能数字（-80% 等）无复现方法，不采信。
- **可借鉴清单（按性价比排序，全部已映射到路线）**
  1. **RAW 源码切换**（极便宜：`renderedHtml` ↔ 源文本 + 现有快捷键位；P1 内做，见 R5）。
  2. **最近文档**（便宜：`chrome.storage.local` 数组，复用 scroll-memory 的 key 规范；P1 内做，见 R6）。
  3. **文件夹书签**（中：workspace_root 单值 → 多根数组；P2，见 R7）。
  4. 阅读进度 % + 读完态（我们 `TopHeader` 已有 `readingProgress` 条，补数字 + P2-3 resume，见 R8）。
  5. Mermaid 缩放/导出、图片画廊手势（中：现有 lightbox/mermaid 增强链上加，P2）。
  6. DOCX 导出、演示模式、外链预览卡：**明确不做**（重/偏/需网络），记入非目标。

### A5. mdview.io（在线阅读器）+ 桌面版 Early Access [中]

- **定位**：免安装、跨浏览器、技术文档渲染全（GFM 表格、高亮、Mermaid、KaTeX）。
- **长处**：受管电脑/临时机器可用；官方指南把“选型四要素”（file-URL 权限、flavor、Mermaid/LaTeX、维护与权限）写得很清楚——可直接抄成我们的**新手引导 + 选型自测页**；“Safe Test File”概念（任务列表+表格+行内公式+Mermaid 四件套）就是我们要建的 fixture。
- **短处**：要经过它的站（隐私模型不如纯本地）；无文件夹流、无编辑；桌面版还在 early access。
- **结论**：它吃的是“一次性/受管”场景，与我们“天天读本地文档”错峰；**借鉴它的内容（评测方法论），不跟进它的形态**。

### A6. 长尾（Markless / md-reader / markdownReader / CSDN 系） [中]

- 共性：单点实验（阅读模式、CSDN 受众引导）、质量碎片化、大量在 `file://` opaque-origin 上翻车。
- **结论**：t2/t3 修的正是这类翻车（SW 冷启动竞态、pushState SecurityError），“可靠性”已经是我们的差异化，不用再投；保持回归即可。

---

## B. 相邻产品（借思路，不竞争）

### B1. Typora（一锤子买卖的 WYSIWYG 标杆） [中]

- **长处**：所见即所得无缝编辑、主题市场、大纲、导出 PDF/HTML/Word（含样式）、打字机/专注模式。
- **可借鉴**：导出质量 bar（“像素级保真”应成为 P1-2 的验收词）；专注模式记入远期 backlog；主题市场是 P2-5 的灵感（但我们先做“打印主题 + CN 字体栈 + 对比度审计”三件套，不做市场）。
- **短处（相对我们）**：桌面 App，无浏览器 `file://` 流；付费；编辑深度超出我们 scope（我们只到改错别字级）。

### B2. Obsidian（本地优先 PKM，验证我们路线的存在性） [中]

- **关键证据**：Obsidian 按笔记记忆滚动/光标、命令面板、插件生态——说明“P0-1 按文档记忆 + ⌘K + 插件开关”不是 feature creep，而是**品类标配**。我们的 `mdPlugins` 开关阵列 + `SearchPaletteModal` + `scroll-memory` 恰好对齐，继续加深即可。
- **可借鉴**：resume strip（“继续阅读”一键回位，P2-3）、workspace 多根（P2 书签）、`storage.local` 配额管理（≥20 文档不爆，P0-1 验收已有）。
- **不竞争**：vault 双链/图谱/日记是 PKM 世界观，浏览器阅读器不跟。

### B3. Notion（协同文档 + AI） [中]

- **可借鉴就两条**：slash 命令的易发现性（我们的 `InPlaceFormattingToolbar` 应补“可发现性”走查，P1 小项）；**作为 P1-4 富文本粘贴的验收靶场**（微信/知乎/Notion 三靶，fixture 见 R3）。
- **不竞争**：云端账号模型与本地优先相反。

### B4. Logseq（大纲块引用） [中]

- **可借鉴就一条**：块锚点 → 标题锚链 + “复制章节链接”（P2-2 的全部灵感来源；GitHub `#slug` 语义，跨重渲染稳定）。
- **不竞争**：outliner 范式、桌面优先。

### B5. VS Code Markdown 预览（编辑↔预览同步的天花板） [中]

- **可借鉴**：大纲↔内容滚动同步（我们的 ScrollSpy 已有，P2-4 大文档下加固）；分屏对照测试法（实现 P1-2/P1-4 时以 VS Code 渲染为参照）。
- **不竞争**：重型、不解决阅读流。

---

## C. 未解痛点总览（U1–U12 + 新增 N1–N8）

U1–U12 见 `docs/product-plan.md` §3（证据链不变）。本次新增：

| ID | 痛点 | 覆盖状态 | 去向 |
|---|---|---|---|
| N1 | 无 RAW 源码一键切换（开发者/作者对照） | 无 | **P1 做（R5）** |
| N2 | 无最近文档（多项目切换丢上下文） | 无 | **P1 做（R6）** |
| N3 | 渲染链无系统化 XSS 消毒（DOMPurify 级） | t4 注记，未修 | **P1 做（R0 安全）** |
| N4 | 应用内 UI 只有中文（`_locales` 8 语言仅 manifest） | t4 注记，未修 | P2 做（对标 Reader 的极简 i18n） |
| N5 | 无 fixture 方法论（回归靠手） | `test.md` 缺失 | **P1 做（R9 每个功能配 fixture）** |
| N6 | 粘贴路径尾巴（`…md)`/`…md）`）打不开 | 无 | **P1 做（顺手，R4 子项）** |
| N7 | 无文件夹书签（多根工作区） | 单 root | P2 做（R7） |
| N8 | 受管电脑装不了扩展 | 形态决定 | 不做（给在线版留位置，不承诺） |

## D. 给开发落地的三条铁律（本轮 Phase-2 通用）

1. **安全先行（R0）**：任何新增渲染面（导出 HTML、锚链、搜索摘要）必须过消毒链；`target=_blank` 配 `rel=noopener`；审计 t4 的“`@import` 外联”注记在本轮关闭。
2. **一目标一英文 commit**（`Tinker Agora <tinkeragora@users.noreply.github.com>`），零 `dist`，`pnpm run build` + `tsc --noEmit` + `git diff --check` + manifest 存在性全绿（t8 门禁延续）。
3. **fixture 即验收**：`reference/fixtures/<feature>.md` 入库 + `docs/requirements-p1p2.md` 对应验收表打勾；Chrome 真机项标 `[manual]`，由用户终验。
