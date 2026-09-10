# Markdown 渲染方案对比分析与改进记录

> 2026-09-11。对标 Typora / Obsidian / GitHub 渲染管线与 markdown-it 生态，评估 MarkCraft 现状并落地改进。

## 一、对标对象与结论概览

| 对标 | 渲染核心 | 强项 | 对 MarkCraft 的启示 |
|---|---|---|---|
| GitHub | GFM 管线（自研 cmark-gfm） | 表格/任务列表/autolink 规范化、标题锚点、告警框（`> [!NOTE]`） | 锚点悬停链接、Alert 已对齐；GitHub **不做自动 TOC**，锚点+手写目录是主流实践 |
| Typora | 内置渲染 + 主题 CSS | 主题生态（GitHub/Night/Pixyll/Vue/Drake/Orange Heart 等 90+）、所见即所得 | 主题差异化价值高；Night/Dracula 类深色主题是热门品类 |
| Obsidian | CodeMirror + 内置渲染 | Mermaid 内置、KaTeX、脚注、`[[wiki 链接]]`（插件） | Mermaid/公式已对齐；wiki 链接属双链场景，暂不适用 |
| markdown-it 生态 | [mdit-plugins 套件](https://mdit-plugins.github.io/) | abbr、alerts、anchors/permalinks、attrs、align 等 | anchors（标题锚点）按 GitHub 方式落地；attrs/align 列入后备 |

## 二、本次落地的改进

1. **深色主题代码高亮适配**：`highlight.js/styles/github.css` 仅提供浅色令牌色，
   深色主题下字符串（#032f62）等令牌几乎不可读。现按 `data-mdr-theme` 为
   dark / nordic / dracula 统一覆盖为深色友好令牌配色（关键字红、字符串绿、
   数字黄、符号蓝、注释斜体灰）。
2. **标题锚点悬停链接**（GitHub 式）：悬停 h1–h6 显示 `#`，点击复制
   `URL#slug` 锚点链接；slug 已由 WASM 端 `build_outline` 生成。
3. **`[TOC]` 目录支持**：`DEFAULT_PLUGINS` 中的 `TOC` 此前无实现，现内置
   markdown-it 核心规则——`[TOC]` 独占段落时渲染目录卡片，条目由大纲数据
   填充（与右侧大纲同源，编辑时随大纲实时刷新），受插件开关控制。

## 三、评估后暂不采纳

| 候选特性 | 不采纳原因 |
|---|---|
| 替换 markdown-it 为 remark/mdh/markdown-wasm | 现有插件链（KaTeX/Mermaid/脚注/多线表格/Alerts）迁移成本高、兼容风险大；基准测试渲染 33KB 文档 P95 约 2.6ms，非瓶颈 |
| attrs/align/container 插件 | 语法噪音较高，与"本地阅读优先"定位不符；列入后备 |
| `[[wiki 链接]]` 双链 | 需要全库索引与反链面板，超出浏览器内单文件阅读场景 |
| 代码行号 | hljs 输出按 token 而非按行，CSS counter 方案不可靠，需重构高亮管线 |
| 自动 TOC 侧栏常驻 | 已有右侧大纲面板承担该职责，`[TOC]` 满足"文内目录"需求 |

## 四、后续可探索

- 图片懒加载与 Mermaid 按需初始化（长文档首屏性能）
- 打印/导出 PDF 专用样式优化（现有 `print:hidden` 已隐藏 UI）
- `mark` 高亮搜索（⌘F 接管并高亮全部命中）
- 阅读位置记忆（刷新后恢复滚动位置）

## 参考

- [GFM Spec](https://github.github.com/gfm/) · [GitHub 基础写法](https://docs.github.com/github/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [Typora 官方主题库](http://theme.typora.io/) · [VLOOK](https://madmaxchow.github.io/VLOOK/)
- [mdit-plugins 套件](https://mdit-plugins.github.io/) · [markdown-it-katex](https://github.com/waylonflinn/markdown-it-katex)
- [Dracula 规范](https://draculatheme.com/spec) · [Nord 官方](https://www.nordtheme.com/)
