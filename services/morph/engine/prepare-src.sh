#!/usr/bin/env bash
# Clone OpenCode, apply Morph branding, install deps (for bun-run Morph).
set -euo pipefail

ENGINE_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(tr -d '[:space:]' < "$ENGINE_DIR/VERSION")"
SRC_DIR="${MORPH_SRC_DIR:-$HOME/.cache/morph/engine-src-$VERSION}"

ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
info() { printf '· %s\n' "$*"; }
die() { printf '\033[31m✗ %s\n' "$*" >&2; exit 1; }

command -v bun >/dev/null 2>&1 || die "bun required"
command -v git >/dev/null 2>&1 || die "git required"

info "Morph engine source → $SRC_DIR (OpenCode v$VERSION)"

if [[ ! -d "$SRC_DIR/.git" ]]; then
  mkdir -p "$(dirname "$SRC_DIR")"
  # Prefer existing /tmp clone if branded
  if [[ -d /tmp/opencode-src/.git ]]; then
    info "Copying /tmp/opencode-src → $SRC_DIR"
    rm -rf "$SRC_DIR"
    mkdir -p "$SRC_DIR"
    # copy without node_modules
    tar -C /tmp/opencode-src --exclude=node_modules --exclude='*/node_modules' -cf - . \
      | tar -C "$SRC_DIR" -xf -
  else
    git clone --depth 1 --branch "v$VERSION" https://github.com/anomalyco/opencode.git "$SRC_DIR" \
      || die "clone failed"
  fi
fi

bash "$ENGINE_DIR/apply-branding.sh" "$SRC_DIR"
cd "$SRC_DIR"
info "bun install…"
bun install 2>&1 | tail -20
ok "Source ready"
echo "$SRC_DIR" > "$ENGINE_DIR/.src-path"
echo "$SRC_DIR"
