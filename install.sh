#!/usr/bin/env sh
# DSH Prompt Enhancer 一键安装（shell 包装）
# 本地仓库模式：直接执行同目录 install.mjs（git clone 后）
# 远程模式（curl | bash）：自动下载 install.mjs 后执行
#
# 用法：bash install.sh [dshCheckoutPath] [--skip-build] [--with-web]
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_CMD="${NODE_CMD:-node}"

if [ -f "$DIR/install.mjs" ]; then
  exec "$NODE_CMD" "$DIR/install.mjs" "$@"
fi

BASE="https://raw.githubusercontent.com/spiceemilissa502-max/dsh-prompt-enhancer/main"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if ! curl -fsSL "$BASE/install.mjs" -o "$TMP/install.mjs" 2>/dev/null; then
  echo "[dsh-prompt-enhancer] ✗ 需要 curl 来下载安装器，请先安装 curl" >&2
  exit 1
fi
exec "$NODE_CMD" "$TMP/install.mjs" "$@"
