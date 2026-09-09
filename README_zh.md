# MarkCraft

MarkCraft 是一款以隐私优先为理念的 Chrome 扩展，用于直接在浏览器中阅读、编辑和管理 Markdown 文件。

它提供完整的 Markdown 阅读体验，支持浏览器内所见即所得编辑、文件与文件夹导航、代码高亮、Mermaid 图表、KaTeX 数学公式、主题、搜索、大纲以及本地文件保存。

## 主要功能

- 在浏览器中阅读 Markdown、MDX、MDC、MKD 和 MARKDOWN 文件
- 在原页面内编辑文档，并在用户明确授权后保存到本地
- 渲染代码块、Mermaid 图表、数学公式、图片、表格和任务列表
- 浏览本地 Markdown 文件夹，使用搜索和文档大纲快速定位内容
- 自定义主题、字体、内容宽度和 Markdown 插件
- 文档内容和设置保留在用户的浏览器与设备本地

## 开发

```bash
npm install
npm run build
```

生产构建产物位于 `dist/`。打开 `chrome://extensions`，启用开发者模式后加载该目录即可进行本地测试。

## 文档

- [English documentation](README.md)

## 隐私

MarkCraft 按本地优先方式设计。正式发布前，请根据当前实现核对扩展权限、文件访问行为和隐私政策。

## 许可证

MarkCraft 当前尚未授予再分发许可。首次公开发布前将补充项目许可证。
