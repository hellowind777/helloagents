#!/usr/bin/env sh
set -eu

# HelloAGENTS one-shot installer.
#
# Environment:
#   HELLOAGENTS=all|claude|gemini|codex[:standby|global]
#   HELLOAGENTS_ACTION=install|update|cleanup|uninstall|switch-branch|branch
#   HELLOAGENTS_TARGET=all|claude|gemini|codex
#   HELLOAGENTS_MODE=standby|global
#   HELLOAGENTS_BRANCH=main|beta|...
#   HELLOAGENTS_PACKAGE=helloagents|https://github.com/owner/repo/archive/refs/heads/ref.tar.gz|...

ACTION="${HELLOAGENTS_ACTION:-install}"
TARGET="${HELLOAGENTS_TARGET:-}"
MODE="${HELLOAGENTS_MODE:-}"
BRANCH="${HELLOAGENTS_BRANCH:-}"
PACKAGE="${HELLOAGENTS_PACKAGE:-}"
HAS_EXPLICIT_PACKAGE=0
HAS_EXPLICIT_TARGET=0
if [ -n "$PACKAGE" ]; then
  HAS_EXPLICIT_PACKAGE=1
fi

if [ -n "${HELLOAGENTS:-}" ]; then
  SPEC_TARGET="${HELLOAGENTS%%:*}"
  SPEC_MODE=""
  if [ -z "$SPEC_TARGET" ]; then
    echo "HELLOAGENTS must be target[:mode], for example codex:global" >&2
    exit 1
  fi
  if [ "$SPEC_TARGET" != "$HELLOAGENTS" ]; then
    SPEC_MODE="${HELLOAGENTS#*:}"
  fi
  TARGET="${TARGET:-$SPEC_TARGET}"
  MODE="${MODE:-$SPEC_MODE}"
fi

if [ -n "$TARGET" ]; then
  HAS_EXPLICIT_TARGET=1
fi

TARGET="${TARGET:-all}"
TARGET="$(printf '%s' "$TARGET" | tr '[:upper:]' '[:lower:]')"
MODE="$(printf '%s' "$MODE" | tr '[:upper:]' '[:lower:]')"

case "$TARGET" in
  all|claude|gemini|codex) ;;
  *) echo "Unsupported HELLOAGENTS target: $TARGET" >&2; exit 1 ;;
esac

if [ -n "$MODE" ]; then
  case "$MODE" in
    standby|global) ;;
    *) echo "Unsupported HELLOAGENTS mode: $MODE" >&2; exit 1 ;;
  esac
fi

if [ -z "$PACKAGE" ]; then
  if [ -n "$BRANCH" ]; then
    PACKAGE="https://github.com/hellowind777/helloagents/archive/refs/heads/$BRANCH.tar.gz"
  else
    PACKAGE="helloagents"
  fi
fi

clear_lifecycle_env() {
  unset HELLOAGENTS
  unset HELLOAGENTS_ACTION
  unset HELLOAGENTS_TARGET
  unset HELLOAGENTS_HOST
  unset HELLOAGENTS_MODE
  unset HELLOAGENTS_BRANCH
  unset HELLOAGENTS_PACKAGE
  unset HELLOAGENTS_DEPLOY
}

clear_lifecycle_env

sync_hosts() {
  if [ "$TARGET" = "all" ]; then
    if [ -n "$MODE" ]; then
      npm explore -g helloagents -- npm run sync-hosts -- --all "--$MODE"
    else
      npm explore -g helloagents -- npm run sync-hosts -- --all
    fi
  else
    if [ -n "$MODE" ]; then
      npm explore -g helloagents -- npm run sync-hosts -- "$TARGET" "--$MODE"
    else
      npm explore -g helloagents -- npm run sync-hosts -- "$TARGET"
    fi
  fi
}

cleanup_hosts() {
  if [ "$TARGET" = "all" ]; then
    if [ -n "$MODE" ]; then
      npm explore -g helloagents -- npm run cleanup-hosts -- --all "--$MODE"
    else
      npm explore -g helloagents -- npm run cleanup-hosts -- --all
    fi
  else
    if [ -n "$MODE" ]; then
      npm explore -g helloagents -- npm run cleanup-hosts -- "$TARGET" "--$MODE"
    else
      npm explore -g helloagents -- npm run cleanup-hosts -- "$TARGET"
    fi
  fi
}

uninstall_hosts() {
  if [ "$TARGET" = "all" ]; then
    if [ -n "$MODE" ]; then
      npm explore -g helloagents -- npm run uninstall -- --all "--$MODE"
    else
      npm explore -g helloagents -- npm run uninstall -- --all
    fi
  else
    if [ -n "$MODE" ]; then
      npm explore -g helloagents -- npm run uninstall -- "$TARGET" "--$MODE"
    else
      npm explore -g helloagents -- npm run uninstall -- "$TARGET"
    fi
  fi
}

enable_postinstall_deploy() {
  export HELLOAGENTS_DEPLOY=1
  export HELLOAGENTS_TARGET="$TARGET"
  export HELLOAGENTS_MODE="${MODE:-standby}"
}

case "$ACTION" in
  install)
    if [ "$HAS_EXPLICIT_TARGET" -eq 1 ]; then
      enable_postinstall_deploy
    fi
    npm install -g "$PACKAGE"
    ;;
  update)
    if [ -n "$BRANCH" ] || [ "$HAS_EXPLICIT_PACKAGE" -eq 1 ]; then
      npm install -g "$PACKAGE"
    else
      npm update -g helloagents || npm install -g helloagents
    fi
    if [ "$HAS_EXPLICIT_TARGET" -eq 1 ]; then
      sync_hosts
    fi
    ;;
  cleanup)
    cleanup_hosts
    ;;
  switch-branch|branch)
    if [ -z "$BRANCH" ] && [ "$HAS_EXPLICIT_PACKAGE" -ne 1 ]; then
      echo "HELLOAGENTS_BRANCH or HELLOAGENTS_PACKAGE is required for switch-branch" >&2
      exit 1
    fi
    npm install -g "$PACKAGE"
    sync_hosts
    ;;
  uninstall)
    if ! uninstall_hosts; then
      echo "Warning: failed to cleanup HelloAGENTS host integrations before uninstall" >&2
    fi
    npm uninstall -g helloagents
    ;;
  *)
    echo "Unsupported HELLOAGENTS_ACTION: $ACTION" >&2
    exit 1
    ;;
esac
