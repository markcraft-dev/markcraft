# MarkCraft

MarkCraft 是一款以隐私优先为理念的 Chrome 扩展，用于直接在浏览器中阅读、编辑和管理 Markdown 文件。

它提供完整的 Markdown 阅读体验，支持浏览器内所见即所得编辑、文件与文件夹导航、代码高亮、Mermaid 图表、KaTeX 数学公式、主题、搜索、大纲以及本地文件保存。

## 主要功能

- 在浏览器中阅读 Markdown、MDX、MDC、MKD 和 MARKDOWN 文件
- 在原页面内编辑文档，并在用户明确授权后保存到本地
- 渲染代码块、Mermaid 图表、数学公式、图片、表格和任务列表
- 浏览本地 Markdown 文件夹，使用搜索和文档大纲快速定位内容
- 通过 ⌘K 命令面板、大纲 ScrollSpy 联动和回到顶部按钮在文档与标题间快速跳转
- 导出自包含 HTML 单文件、打印为 PDF，或复制富文本粘贴到博客与文档中
- 自定义主题、字体、内容宽度和 Markdown 插件
- 可选开启本地文件变更自动重新加载（阅读位置保持不变）
- 文档内容和设置保留在用户的浏览器与设备本地

## 安装

无需搭建构建环境——直接从 [Releases](https://github.com/markcraft-dev/markcraft/releases) 下载预构建包：

1. 从最新 release 下载 `markcraft-vX.Y.Z.zip` 并解压。
2. 打开 `chrome://extensions`，开启右上角「开发者模式」，点击「加载已解压的扩展程序」，选择解压出的 `markcraft` 文件夹。
3. 如需渲染本地文件，点击 MarkCraft 卡片上的「详细信息」，开启「允许访问文件网址」——否则 Chrome 会在 `file://` 页面上拦截扩展，文档只能显示为纯文本。

## 开发

```bash
pnpm install
pnpm run build
```

`pnpm run build` 会先把 Rust 核心算法 crate 编译为 WASM（`pnpm run build:wasm`，需先安装 [wasm-pack](https://rustwasm.github.io/wasm-pack/)），再把扩展打包到 `dist/`。打开 `chrome://extensions`，启用开发者模式后加载该目录即可进行本地测试。

### 可选：本地文件零弹窗保存

`file://` 页面属于不透明来源（opaque origin），Chrome 在其上禁用 IndexedDB，File System Access 的授权无法持久化——每次刷新后保存都会重新弹出授权对话框。安装配套的 Rust Native Messaging 宿主后，保存将直接覆盖本地原文件，全程零弹窗：

```bash
cd native-host && ./install.sh   # 安装后在 chrome://extensions 中重新加载扩展
```

## 文档

- [English documentation](README.md)
- [WASM 核心层架构](docs/wasm_core.zh-CN.md) / [WASM core architecture](docs/wasm_core.md)
- [代码库全量分析](docs/codebase_analysis.zh-CN.md)
- [性能优化说明](docs/performance_optimization.zh-CN.md) / [Performance notes](docs/performance_optimization.md)
- [渲染管线复核](docs/rendering_review.zh-CN.md)
- [产品计划 (Product plan)](docs/product-plan.md)

## 隐私

MarkCraft 为本地优先：文档内容不出设备。扩展仅申请两个 Chrome 权限——`storage`（仅存设置）与 `nativeMessaging`（可选的零弹窗保存能力，连接自带的本机写入宿主；未安装宿主时不生效）。渲染全在页面内完成；仅在你打开文档或目录时获取远端 Markdown，且响应大小受限。保存永远只写你正在看的文件：静默覆盖只使用该完整文件 URL 事先授权过的句柄；本机宿主拒绝新建文件与跟随符号链接；其余路径都会先征得你的同意。注意：设置中粘贴的自定义 CSS 会按原样注入渲染页——若常读敏感本地文件，请勿使用远端 `@import`。

## 许可证

MarkCraft 基于 [MIT 许可证](LICENSE) 发布。
