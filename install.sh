#!/usr/bin/env sh
set -eu

# HelloAGENTS one-shot installer.
#
# Environment:
#   HELLOAGENTS_ACTION=install|update|uninstall|switch-branch|branch
#   HELLOAGENTS_TARGET=all|claude|gemini|codex
#   HELLOAGENTS_MODE=standby|global
#   HELLOAGENTS_BRANCH=main|beta|...
#   HELLOAGENTS_PACKAGE=helloagents|github:owner/repo#ref|...

ACTION="${HELLOAGENTS_ACTION:-install}"
TARGET="${HELLOAGENTS_TARGET:-all}"
MODE="${HELLOAGENTS_MODE:-standby}"
BRANCH="${HELLOAGENTS_BRANCH:-}"
PACKAGE="${HELLOAGENTS_PACKAGE:-}"

if [ -z "$PACKAGE" ]; then
  if [ -n "$BRANCH" ]; then
    PACKAGE="github:hellowind777/helloagents#$BRANCH"
  else
    PACKAGE="helloagents"
  fi
fi

sync_hosts() {
  if [ "$TARGET" = "all" ]; then
    npm explore -g helloagents -- npm run sync-hosts -- --all "--$MODE"
  else
    npm explore -g helloagents -- npm run sync-hosts -- "$TARGET" "--$MODE"
  fi
}

cleanup_hosts() {
  if [ "$TARGET" = "all" ]; then
    npm explore -g helloagents -- npm run cleanup-hosts -- --all "--$MODE"
  else
    npm explore -g helloagents -- npm run cleanup-hosts -- "$TARGET" "--$MODE"
  fi
}

enable_postinstall_deploy() {
  export HELLOAGENTS_DEPLOY=1
  export HELLOAGENTS_TARGET="$TARGET"
  export HELLOAGENTS_MODE="$MODE"
}

case "$ACTION" in
  install)
    enable_postinstall_deploy
    npm install -g "$PACKAGE"
    ;;
  update)
    if [ -n "$BRANCH" ] || [ -n "${HELLOAGENTS_PACKAGE:-}" ]; then
      npm install -g "$PACKAGE"
    else
      npm update -g helloagents || npm install -g helloagents
    fi
    sync_hosts
    ;;
  switch-branch|branch)
    if [ -z "$BRANCH" ] && [ -z "${HELLOAGENTS_PACKAGE:-}" ]; then
      echo "HELLOAGENTS_BRANCH or HELLOAGENTS_PACKAGE is required for switch-branch" >&2
      exit 1
    fi
    npm install -g "$PACKAGE"
    sync_hosts
    ;;
  uninstall)
    if ! cleanup_hosts; then
      echo "Warning: failed to cleanup HelloAGENTS host integrations before uninstall" >&2
    fi
    npm uninstall -g helloagents
    ;;
  *)
    echo "Unsupported HELLOAGENTS_ACTION: $ACTION" >&2
    exit 1
    ;;
esac
