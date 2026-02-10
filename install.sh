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

info()  { printf "${CYAN}[info]${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
error() { printf "${RED}[error]${RESET} %s\n" "$*"; exit 1; }

# ─── Step 1: Detect Python ───
info "Detecting Python..."

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
    error "Python >= 3.10 is required but not found. Please install Python first."
fi

ok "Found $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))"

# ─── Step 2: Detect uv ───
info "Checking for uv..."

HAS_UV=false
if command -v uv >/dev/null 2>&1; then
    HAS_UV=true
    ok "Found uv ($(uv --version 2>&1))"
else
    warn "uv not found, will fall back to pip."
fi

# ─── Step 3: Install ───
printf "\n${BOLD}Installing HelloAGENTS from branch: ${CYAN}${BRANCH}${RESET}\n\n"

if [ "$HAS_UV" = true ]; then
    info "Installing with uv..."
    if [ "$BRANCH" = "main" ]; then
        uv tool install --force --from "git+${REPO}" helloagents
    else
        uv tool install --force --from "git+${REPO}@${BRANCH}" helloagents
    fi
else
    info "Installing with pip..."
    if [ "$BRANCH" = "main" ]; then
        "$PYTHON_CMD" -m pip install --upgrade "git+${REPO}.git"
    else
        "$PYTHON_CMD" -m pip install --upgrade "git+${REPO}.git@${BRANCH}"
    fi
fi

# ─── Step 4: Verify ───
printf "\n"
info "Verifying installation..."

if command -v helloagents >/dev/null 2>&1; then
    ok "helloagents installed successfully!"
    helloagents version 2>/dev/null || true
else
    warn "helloagents command not found in PATH."
    warn "You may need to restart your terminal or add the install location to PATH."
fi

# ─── Done ───
printf "\n${BOLD}${GREEN}Installation complete!${RESET}\n\n"
echo "Next steps:"
echo "  helloagents install codex      # sync rules to Codex CLI"
echo "  helloagents install claude     # sync rules to Claude Code"
echo "  helloagents install --all      # sync rules to all detected CLIs"
echo ""
echo "  helloagents status             # check installation status"
echo "  helloagents update             # update to latest version"
echo ""
