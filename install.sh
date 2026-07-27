#!/bin/sh
# HelloAGENTS 一键安装脚本（macOS / Linux）。
# 环境变量：
#   HELLOAGENTS_HOSTS   目标宿主，逗号分隔（claude,codex,grok,cursor,hermes），默认 all
#   HELLOAGENTS_METHOD  安装方式：inject 或 plugin，默认由各宿主自动选择
#   HELLOAGENTS_VERSION npm 版本标签，默认 latest
set -eu

VERSION="${HELLOAGENTS_VERSION:-latest}"
HOSTS="${HELLOAGENTS_HOSTS:-all}"
METHOD="${HELLOAGENTS_METHOD:-}"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装 Node.js 20.19 或更高版本。" >&2
  echo "Node.js not found. Install Node.js 20.19 or newer first." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm，请确认 Node.js 安装完整。" >&2
  echo "npm not found. Make sure your Node.js installation is complete." >&2
  exit 1
fi

echo "安装 helloagents@${VERSION} …"
npm install -g "helloagents@${VERSION}"

set -- install
if [ "$HOSTS" = "all" ]; then
  set -- "$@" --all
else
  OLD_IFS="$IFS"; IFS=','
  for host in $HOSTS; do
    host=$(echo "$host" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    set -- "$@" "$host"
  done
  IFS="$OLD_IFS"
fi
case "$METHOD" in
  inject) set -- "$@" --inject ;;
  plugin) set -- "$@" --plugin ;;
  '') ;;
  *)
    echo "HELLOAGENTS_METHOD 只接受 inject 或 plugin，当前值：$METHOD" >&2
    exit 1
    ;;
esac

helloagents "$@"
helloagents doctor
