#!/usr/bin/env sh
# DSH Prompt Enhancer — 一键安装（shell 包装，自动探测 DSH checkout 或接收第一个参数）
# 用法：bash install.sh [dshCheckoutPath]
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_CMD="${NODE_CMD:-node}"
exec "$NODE_CMD" "$DIR/install.mjs" "$@"
