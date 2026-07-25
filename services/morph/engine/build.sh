#!/usr/bin/env bash
# Build Morph engine (OpenCode fork with Morph branding).
# Output: dist/morph (standalone binary)
set -euo pipefail

ENGINE_DIR="$(cd "$(dirname "$0")" && pwd)"
MORPH_ROOT="$(cd "$ENGINE_DIR/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$ENGINE_DIR/VERSION")"
SRC_DIR="${MORPH_SRC_DIR:-$HOME/.cache/morph/engine-src-$VERSION}"
DIST_DIR="${MORPH_ENGINE_DIST:-$MORPH_ROOT/dist}"
BIN_OUT="$DIST_DIR/morph"

ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
info() { printf '· %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

command -v bun >/dev/null 2>&1 || die "bun required (https://bun.sh)"
command -v git >/dev/null 2>&1 || die "git required"

info "Morph engine build (OpenCode v$VERSION + Morph branding)"
info "source  $SRC_DIR"
info "output  $BIN_OUT"

# Fetch / update source
if [[ ! -d "$SRC_DIR/.git" ]]; then
  mkdir -p "$(dirname "$SRC_DIR")"
  info "Cloning anomalyco/opencode @ v$VERSION…"
  git clone --depth 1 --branch "v$VERSION" https://github.com/anomalyco/opencode.git "$SRC_DIR" \
    || git clone --depth 1 --branch "v$VERSION" https://github.com/sst/opencode.git "$SRC_DIR" \
    || die "clone failed"
else
  info "Reusing existing source checkout"
fi

# Fresh branding every build (idempotent-ish)
bash "$ENGINE_DIR/apply-branding.sh" "$SRC_DIR"

cd "$SRC_DIR"
info "bun install…"
bun install --frozen-lockfile 2>/dev/null || bun install

info "Building standalone morph binary (single target, no embedded web UI)…"
cd packages/opencode
# Prefer skip web UI for faster builds
if bun run script/build.ts --single --skip-embed-web-ui 2>&1 | tee /tmp/morph-engine-build.log; then
  ok "build script finished"
else
  info "retry without --skip-embed-web-ui…"
  bun run script/build.ts --single 2>&1 | tee /tmp/morph-engine-build.log || die "build failed — see /tmp/morph-engine-build.log"
fi

# Locate produced binary
BUILT=""
for cand in \
  dist/morph-linux-x64/bin/morph \
  dist/morph-linux-x64/bin/opencode \
  dist/opencode-linux-x64/bin/opencode \
  dist/opencode-linux-x64/bin/morph \
  dist/*/bin/morph \
  dist/*/bin/opencode
do
  # shellcheck disable=SC2086
  for p in $cand; do
    if [[ -f "$p" && -x "$p" ]]; then BUILT="$p"; break 2; fi
  done
done

# glob fallback
if [[ -z "$BUILT" ]]; then
  BUILT="$(find dist -type f \( -name morph -o -name opencode \) -perm -111 2>/dev/null | head -1 || true)"
fi

[[ -n "$BUILT" && -f "$BUILT" ]] || {
  find dist -type f 2>/dev/null | head -40
  die "could not find built binary under packages/opencode/dist"
}

mkdir -p "$DIST_DIR"
cp -f "$BUILT" "$BIN_OUT"
chmod +x "$BIN_OUT"
# Also copy next to package bin for install.sh
cp -f "$BIN_OUT" "$MORPH_ROOT/bin/morph-engine"
chmod +x "$MORPH_ROOT/bin/morph-engine"

ok "Morph engine binary → $BIN_OUT"
ok "Also → $MORPH_ROOT/bin/morph-engine"
"$BIN_OUT" --version 2>/dev/null || true
echo ""
info "Config will use ~/.config/morph (not ~/.config/opencode)"
