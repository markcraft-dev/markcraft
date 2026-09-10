# MarkCraft 本机写入宿主（Native Messaging Host）

一个极小的 Rust 守护程序，让 MarkCraft 扩展**零弹窗、直接覆盖保存本地 Markdown 原文件**。

## 为什么需要它

Chrome 的安全模型禁止网页（含 `file://` 本地页面）在没有用户手势授权的情况下写磁盘；而 `file://` 页面属于透明来源（opaque origin），**IndexedDB 被浏览器禁用**，导致扩展无法持久化 File System Access 句柄——每次刷新页面授权都会丢失，保存就会反复弹出目录/文件选择框。

本宿主通过 Chrome 官方的 Native Messaging 通道接管写盘：扩展把 `{path, content}` 发给宿主，宿主直接覆盖原文件。**安装一次后，保存不再弹出任何对话框。**

## 安全设计

- 仅接受**绝对路径**，且目标文件必须**已存在**（只覆盖、绝不新建）
- 宿主清单中的 `allowed_origins` 锁定到 MarkCraft 扩展 ID，其他扩展无法调用
- 纯本地 stdio 通信，无网络行为

## 安装

```bash
cd native-host
./install.sh            # 默认使用仓库下的 dist/ 目录计算扩展 ID
# 或指定扩展目录 / 显式扩展 ID：
./install.sh /path/to/dist
./install.sh --id <你的32位扩展ID>
```

脚本会：

1. `cargo build --release` 构建宿主二进制
2. 计算未打包扩展的 ID（扩展目录绝对路径 SHA-256 前 32 位，0-9a-f → a-p）
3. 把宿主清单写入 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.markcraft.filewriter.json`（Linux 为 `~/.config/google-chrome/NativeMessagingHosts/`）

完成后在 `chrome://extensions` 中**重新加载 MarkCraft 扩展**即可。

> Windows：需将清单路径写入注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.markcraft.filewriter`，暂未提供脚本。

## 卸载

删除 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.markcraft.filewriter.json`。

## 协议

Chrome Native Messaging 标准帧：4 字节小端长度 + JSON。

- 请求：`{"path": "/abs/file.md", "content": "..."}`
- 响应：`{"ok": true}` 或 `{"ok": false, "error": "..."}`

未安装宿主时扩展自动回退：目录授权（每文件夹一次）→ 单文件另存对话框，功能不降级。
