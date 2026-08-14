#!/bin/sh
# HelloAGENTS 一键安装脚本（macOS / Linux）。
# 环境变量：
#   HELLOAGENTS_HOSTS     目标宿主，逗号分隔（claude,codex,grok,cursor,hermes,dsh），默认 all
#   HELLOAGENTS_METHOD    安装方式：standard 或 global，默认由各宿主自动选择
#   HELLOAGENTS_VERSION   npm 版本标签，默认 latest（npm 来源时生效）
#   HELLOAGENTS_SOURCE    安装来源：npm 或 git，默认 npm
#   HELLOAGENTS_BRANCH    Git 分支（git 来源时生效），默认 main
#   HELLOAGENTS_GIT_URL   Git 远程地址（git 来源时生效），默认官方仓库
set -eu

VERSION="${HELLOAGENTS_VERSION:-latest}"
HOSTS="${HELLOAGENTS_HOSTS:-all}"
METHOD="${HELLOAGENTS_METHOD:-}"
SOURCE="${HELLOAGENTS_SOURCE:-npm}"
BRANCH="${HELLOAGENTS_BRANCH:-main}"
GIT_URL="${HELLOAGENTS_GIT_URL:-https://github.com/hellowind777/helloagents.git}"

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

if [ "$SOURCE" = "git" ]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "HELLOAGENTS_SOURCE=git 但未找到 Git。请先安装 Git 或改用 npm 来源。" >&2
    exit 1
  fi
  SOURCE_DIR="$HOME/.helloagents/source"
  if [ -d "$SOURCE_DIR/.git" ]; then
    echo "更新已有仓库（分支：$BRANCH）…"
    git -C "$SOURCE_DIR" fetch origin "$BRANCH"
    git -C "$SOURCE_DIR" checkout "$BRANCH"
    git -C "$SOURCE_DIR" reset --hard "origin/$BRANCH"
  else
    echo "克隆仓库（分支：$BRANCH）…"
    mkdir -p "$SOURCE_DIR"
    git clone --branch "$BRANCH" --single-branch "$GIT_URL" "$SOURCE_DIR"
  fi
  echo "通过 npm 链接本地仓库…"
  npm install -g "$SOURCE_DIR"
else
  echo "安装 helloagents@${VERSION} …"
  npm install -g "helloagents@${VERSION}"
fi

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
  standard)  set -- "$@" --standard ;;
  global)    set -- "$@" --global ;;
  inject)    set -- "$@" --standard ;;  # 旧版兼容
  plugin)    set -- "$@" --global ;;    # 旧版兼容
  '') ;;
  *)
    echo "HELLOAGENTS_METHOD 只接受 standard 或 global，当前值：$METHOD" >&2
    exit 1
    ;;
esac

helloagents "$@"
helloagents doctor
