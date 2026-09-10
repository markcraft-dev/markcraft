#!/usr/bin/env bash
# MarkCraft 本机写入宿主安装脚本
#
# 用法：
#   ./install.sh [扩展目录] [--id <extension_id>]
#
# 说明：
#   - 扩展目录默认为仓库下的 dist/（未打包扩展的 ID 由其绝对路径决定，
#     本脚本会自动计算）；也可以用 --id 显式指定 chrome://extensions 中显示的 ID。
#   - 执行后需在 chrome://extensions 中重新加载 MarkCraft 扩展。
set -euo pipefail

HOST_NAME="com.markcraft.filewriter"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRATE_DIR="$SCRIPT_DIR/markcraft-file-writer"
EXT_DIR_ARG=""
EXT_ID_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id)
      EXT_ID_ARG="$2"
      shift 2
      ;;
    *)
      EXT_DIR_ARG="$1"
      shift
      ;;
  esac
done

echo "==> 构建本机宿主 (cargo build --release)"
cargo build --release --manifest-path "$CRATE_DIR/Cargo.toml"
BIN="$CRATE_DIR/target/release/markcraft-file-writer"
[[ -x "$BIN" ]] || { echo "构建产物不存在: $BIN" >&2; exit 1; }

if [[ -n "$EXT_ID_ARG" ]]; then
  EXT_ID="$EXT_ID_ARG"
else
  EXT_DIR="${EXT_DIR_ARG:-$SCRIPT_DIR/../dist}"
  REAL_EXT_DIR="$(cd "$EXT_DIR" && pwd -P)"
  # 未打包扩展的 ID = 扩展目录绝对路径的 SHA-256 前 32 位（0-9a-f 映射为 a-p）
  EXT_ID="$(printf '%s' "$REAL_EXT_DIR" | { shasum -a 256 2>/dev/null || sha256sum; } | awk '{print substr($1,1,32)}' | tr '0-9a-f' 'a-p')"
  echo "==> 扩展目录: $REAL_EXT_DIR"
fi
[[ "$EXT_ID" =~ ^[a-p]{32}$ ]] || { echo "扩展 ID 格式异常: $EXT_ID" >&2; exit 1; }
echo "==> 扩展 ID: $EXT_ID"

case "$(uname -s)" in
  Darwin)
    # 正式版 Chrome / Chrome for Testing / Chromium 各有独立清单目录，全部覆盖
    MANIFEST_DIRS=(
      "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
      "$HOME/Library/Application Support/Google/Chrome for Testing/NativeMessagingHosts"
      "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
    )
    ;;
  Linux)
    MANIFEST_DIRS=(
      "$HOME/.config/google-chrome/NativeMessagingHosts"
      "$HOME/.config/google-chrome-for-testing/NativeMessagingHosts"
      "$HOME/.config/chromium/NativeMessagingHosts"
    )
    ;;
  *)
    echo "暂不支持的平台: $(uname -s)（Windows 需写注册表，见 README）" >&2
    exit 1
    ;;
esac
for MANIFEST_DIR in "${MANIFEST_DIRS[@]}"; do
  mkdir -p "$MANIFEST_DIR"
  MANIFEST_PATH="$MANIFEST_DIR/$HOST_NAME.json"
  cat > "$MANIFEST_PATH" <<EOF
{
  "name": "$HOST_NAME",
  "description": "MarkCraft in-place Markdown file writer",
  "path": "$BIN",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF
  echo "==> 已写入宿主清单: $MANIFEST_PATH"
done
echo ""
echo "完成！请在 chrome://extensions 中重新加载 MarkCraft 扩展，之后保存将直接覆盖原文件（零弹窗）。"
echo "卸载：删除以上各 NativeMessagingHosts 目录中的 com.markcraft.filewriter.json 即可。"
