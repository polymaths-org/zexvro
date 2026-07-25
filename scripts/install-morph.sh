#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Morph CLI installer — ZEXVRO Web2→Web3 transformation agent
#
# One-liner (works on a fresh machine):
#   curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash
#
# From a zexvro checkout:
#   bash scripts/install-morph.sh
#   bash services/morph/install.sh
#
# Env:
#   MORPH_BUILD_BINARY=1   build standalone engine binary (default: 1)
#   MORPH_BUILD_BINARY=0   skip binary; run via bun + branded source
#   MORPH_INSTALL_DIR      default ~/.local/share/morph
#   MORPH_BIN_DIR          default ~/.local/bin
#   MORPH_REPO_URL         default https://github.com/polymaths-org/zexvro
#   MORPH_BRANCH           default main
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

export MORPH_BUILD_BINARY="${MORPH_BUILD_BINARY:-1}"
export MORPH_INSTALL_DIR="${MORPH_INSTALL_DIR:-$HOME/.local/share/morph}"
export MORPH_BIN_DIR="${MORPH_BIN_DIR:-$HOME/.local/bin}"
export MORPH_REPO_URL="${MORPH_REPO_URL:-https://github.com/polymaths-org/zexvro}"
export MORPH_BRANCH="${MORPH_BRANCH:-main}"

die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
info() { printf '· %s\n' "$*"; }

# Prefer package install.sh from this monorepo when present (dev / local checkout)
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  LOCAL_INSTALL="$HERE/../services/morph/install.sh"
  if [[ -f "$LOCAL_INSTALL" && -f "$HERE/../services/morph/seed/morph.jsonc" ]]; then
    exec bash "$LOCAL_INSTALL"
  fi
fi

# Remote one-liner: clone the Morph package and run its install.sh
command -v git >/dev/null 2>&1 || die "git required"
command -v curl >/dev/null 2>&1 || die "curl required"

TMP=$(mktemp -d)
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

info "cloning Morph package from $MORPH_REPO_URL ($MORPH_BRANCH)…"

# Sparse clone — only services/morph (faster, still needs full package on branch)
if git clone --depth 1 --filter=blob:none --sparse --branch "$MORPH_BRANCH" \
    "$MORPH_REPO_URL" "$TMP/zexvro" >/dev/null 2>&1; then
  (
    cd "$TMP/zexvro"
    git sparse-checkout set services/morph
  ) || true
else
  git clone --depth 1 --branch "$MORPH_BRANCH" "$MORPH_REPO_URL" "$TMP/zexvro" >/dev/null 2>&1 \
    || git clone --depth 1 "$MORPH_REPO_URL" "$TMP/zexvro" >/dev/null 2>&1 \
    || die "failed to clone $MORPH_REPO_URL"
fi

PKG_SRC="$TMP/zexvro/services/morph"
[[ -f "$PKG_SRC/install.sh" ]] || die "morph package missing in repo (no services/morph/install.sh)"
[[ -f "$PKG_SRC/seed/morph.jsonc" ]] || die "incomplete Morph package on $MORPH_BRANCH — missing seed/morph.jsonc (push seed/ to the branch)"
[[ -f "$PKG_SRC/bin/morph" ]] || die "incomplete Morph package — missing bin/morph"
[[ -f "$PKG_SRC/engine/apply-branding.sh" ]] || die "incomplete Morph package — missing engine branding"

# Hand off to package installer (it re-copies into MORPH_INSTALL_DIR)
export MORPH_PACKAGE_SRC="$PKG_SRC"
exec bash "$PKG_SRC/install.sh"
