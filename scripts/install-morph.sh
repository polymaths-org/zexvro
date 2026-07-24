#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Morph CLI installer — ZEXVRO Web2→Web3 transformation agent
#
# One-liner:
#   curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash
#
# Or from a zexvro checkout:
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

# Prefer running the package install.sh from this repo if present
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$HERE/../services/morph/install.sh" ]]; then
    exec bash "$HERE/../services/morph/install.sh"
  fi
fi

# Remote one-liner path: fetch package install via git sparse or full clone
command -v git >/dev/null 2>&1 || { echo "git required" >&2; exit 1; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "· cloning Morph package from $MORPH_REPO_URL ($MORPH_BRANCH)…"
git clone --depth 1 --branch "$MORPH_BRANCH" "$MORPH_REPO_URL" "$TMP/zexvro" >/dev/null 2>&1 \
  || git clone --depth 1 "$MORPH_REPO_URL" "$TMP/zexvro" >/dev/null 2>&1
[[ -f "$TMP/zexvro/services/morph/install.sh" ]] || { echo "morph package missing in repo" >&2; exit 1; }
exec bash "$TMP/zexvro/services/morph/install.sh"
