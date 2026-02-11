#!/usr/bin/env bash
set -e

# ─── HelloAGENTS Installer (macOS / Linux) ───
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash
#
# Environment variables:
#   HELLOAGENTS_BRANCH  — branch to install from (default: main)

REPO="https://github.com/hellowind777/helloagents"
BRANCH="${HELLOAGENTS_BRANCH:-main}"

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Locale detection ───
USE_ZH=false
_locale="${LC_ALL:-${LC_MESSAGES:-${LANG:-${LANGUAGE:-}}}}"
case "$_locale" in
    zh*|ZH*) USE_ZH=true ;;
esac

msg() {
    if [ "$USE_ZH" = true ]; then
        echo "$1"
    else
        echo "$2"
    fi
}

info()  { printf "${CYAN}[info]${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
error() { printf "${RED}[error]${RESET} %s\n" "$*"; exit 1; }

# ─── Step 1: Detect Python ───
info "$(msg "检测 Python..." "Detecting Python...")"

PYTHON_CMD=""
for cmd in python3 python; do
    if command -v "$cmd" >/dev/null 2>&1; then
        version=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
        major=$(echo "$version" | cut -d. -f1)
        minor=$(echo "$version" | cut -d. -f2)
        if [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 10 ]; }; then
            PYTHON_CMD="$cmd"
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    error "$(msg "需要 Python >= 3.10，但未找到。请先安装 Python。" "Python >= 3.10 is required but not found. Please install Python first.")"
fi

ok "$(msg "找到 $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))" "Found $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))")"

# ─── Step 2: Detect uv ───
info "$(msg "检查 uv..." "Checking for uv...")"

HAS_UV=false
if command -v uv >/dev/null 2>&1; then
    HAS_UV=true
    ok "$(msg "找到 uv ($(uv --version 2>&1))" "Found uv ($(uv --version 2>&1))")"
else
    warn "$(msg "未找到 uv，将使用 pip。" "uv not found, will fall back to pip.")"
fi

# ─── Step 3: Install ───
printf "\n${BOLD}$(msg "正在从分支 ${CYAN}${BRANCH}${RESET}${BOLD} 安装 HelloAGENTS" "Installing HelloAGENTS from branch: ${CYAN}${BRANCH}")${RESET}\n\n"

if [ "$HAS_UV" = true ]; then
    info "$(msg "使用 uv 安装..." "Installing with uv...")"
    if [ "$BRANCH" = "main" ]; then
        uv tool install --force --from "git+${REPO}" helloagents
    else
        uv tool install --force --from "git+${REPO}@${BRANCH}" helloagents
    fi
else
    info "$(msg "使用 pip 安装..." "Installing with pip...")"
    if [ "$BRANCH" = "main" ]; then
        "$PYTHON_CMD" -m pip install --upgrade "git+${REPO}.git"
    else
        "$PYTHON_CMD" -m pip install --upgrade "git+${REPO}.git@${BRANCH}"
    fi
fi

# ─── Step 4: Verify ───
printf "\n"
info "$(msg "验证安装..." "Verifying installation...")"

if command -v helloagents >/dev/null 2>&1; then
    ok "$(msg "helloagents 安装成功！" "helloagents installed successfully!")"
    helloagents version 2>/dev/null || true
else
    warn "$(msg "helloagents 命令未在 PATH 中找到。" "helloagents command not found in PATH.")"
    warn "$(msg "可能需要重启终端或将安装路径加入 PATH。" "You may need to restart your terminal or add the install location to PATH.")"
fi

# ─── Step 5: Interactive target selection ───
printf "\n${BOLD}${GREEN}$(msg "安装完成！" "Installation complete!")${RESET}\n"

if command -v helloagents >/dev/null 2>&1; then
    printf "\n"
    # Redirect stdin from /dev/tty so interactive input works even when piped (curl | bash)
    helloagents </dev/tty
fi
