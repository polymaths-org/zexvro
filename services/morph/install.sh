#!/usr/bin/env bash
# Morph install — Morph application (OpenCode fork + ZEXVRO skills/MCP)
# Prefer: curl -fsSL …/scripts/install-morph.sh | bash
set -euo pipefail

REPO_URL="${MORPH_REPO_URL:-https://github.com/polymaths-org/zexvro}"
BRANCH="${MORPH_BRANCH:-main}"
INSTALL_DIR="${MORPH_INSTALL_DIR:-$HOME/.local/share/morph}"
BIN_DIR="${MORPH_BIN_DIR:-$HOME/.local/bin}"
# Build standalone binary by default so `morph` does not re-brand on every run
BUILD_BIN="${MORPH_BUILD_BINARY:-1}"

ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
info() { printf '· %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

printf '\n\033[1m  MORPH  ·  ZEXVRO transformation agent\033[0m\n'
info "Install dir: $INSTALL_DIR"
info "Binary dir:  $BIN_DIR"
info "Config:      ~/.config/morph"
echo ""

command -v node >/dev/null 2>&1 || die "Node.js 20+ required (https://nodejs.org)"
ok "Node $(node -v)"

if ! command -v bun >/dev/null 2>&1; then
  if [[ "$BUILD_BIN" == "1" ]]; then
    info "Installing bun (needed to build Morph engine)…"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi
fi
command -v bun >/dev/null 2>&1 || die "bun required (https://bun.sh)"
ok "bun $(bun --version 2>/dev/null || echo '?')"

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$INSTALL_DIR/bin"

# Local monorepo checkout?
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$SCRIPT_DIR/bin/morph" && -d "$SCRIPT_DIR/seed" ]]; then
    # Copy package (not only symlink) so install is self-contained after clone
    rm -rf "$INSTALL_DIR/package"
    mkdir -p "$INSTALL_DIR/package"
    # Prefer rsync if available for speed; else cp
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --exclude node_modules --exclude dist --exclude '.src-path' \
        "$SCRIPT_DIR/" "$INSTALL_DIR/package/"
    else
      cp -a "$SCRIPT_DIR/." "$INSTALL_DIR/package/"
      rm -rf "$INSTALL_DIR/package/node_modules" "$INSTALL_DIR/package/dist" 2>/dev/null || true
    fi
    # Keep a link for dev convenience
    ln -sfn "$SCRIPT_DIR" "$INSTALL_DIR/package-dev" 2>/dev/null || true
    ok "Installed Morph package from local checkout"
  fi
fi

if [[ ! -e "$INSTALL_DIR/package/bin/morph" ]]; then
  command -v git >/dev/null 2>&1 || die "git required"
  TMP=$(mktemp -d)
  info "Cloning $REPO_URL ($BRANCH)…"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1 \
    || git clone --depth 1 "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1
  rm -rf "$INSTALL_DIR/package"
  mkdir -p "$INSTALL_DIR/package"
  cp -a "$TMP/zexvro/services/morph/." "$INSTALL_DIR/package/"
  rm -rf "$TMP"
  ok "Morph package installed from GitHub"
fi

PKG="$INSTALL_DIR/package"
[[ -f "$PKG/seed/morph.jsonc" ]] || die "missing seed/morph.jsonc"
[[ -f "$PKG/engine/apply-branding.sh" ]] || die "missing engine branding"
chmod +x "$PKG/bin/morph" "$PKG/engine/"*.sh 2>/dev/null || true
chmod +x "$PKG/bin/"*.mjs 2>/dev/null || true

# Prepare branded engine source once (stamp skips re-brand on later launches)
info "Preparing Morph engine (clone OpenCode + brand once)…"
MORPH_HOME="$PKG" bash "$PKG/engine/prepare-src.sh" || die "prepare-src failed"
# Write content hash stamp so runtime skips re-brand
SRC_DIR="${MORPH_SRC_DIR:-$HOME/.cache/morph/engine-src-$(tr -d '[:space:]' < "$PKG/engine/VERSION" 2>/dev/null || echo 1.18.3)}"
if [[ -f "$PKG/engine/.src-path" ]]; then
  SRC_DIR="$(tr -d '[:space:]' < "$PKG/engine/.src-path")"
fi
if [[ -d "$SRC_DIR" ]]; then
  (
    cd "$PKG" || exit 0
    # same hash inputs as bin/morph brand_inputs_hash
    {
      echo "version:$(tr -d '[:space:]' < engine/VERSION 2>/dev/null)"
      cat engine/VERSION 2>/dev/null
      sha256sum engine/apply-branding.sh 2>/dev/null
      find engine/patches -type f 2>/dev/null | sort | while read -r f; do sha256sum "$f"; done
    } 2>/dev/null | sha256sum | awk '{print $1}' > "$SRC_DIR/.morph-brand-stamp"
  )
  ok "Brand stamp written (no re-brand on each morph launch)"
fi

ENGINE_BIN=""
if [[ "$BUILD_BIN" == "1" ]]; then
  info "Building standalone morph-engine binary (this can take a few minutes)…"
  if MORPH_HOME="$PKG" MORPH_ENGINE_DIST="$INSTALL_DIR/bin" bash "$PKG/engine/build.sh"; then
    if [[ -x "$INSTALL_DIR/bin/morph" ]]; then
      mv -f "$INSTALL_DIR/bin/morph" "$INSTALL_DIR/bin/morph-engine"
    fi
    if [[ -x "$PKG/dist/morph" ]]; then
      cp -f "$PKG/dist/morph" "$INSTALL_DIR/bin/morph-engine"
      chmod +x "$INSTALL_DIR/bin/morph-engine"
    fi
    if [[ -x "$INSTALL_DIR/bin/morph-engine" ]]; then
      ENGINE_BIN="$INSTALL_DIR/bin/morph-engine"
      # Also expose under package for find_engine_bin
      mkdir -p "$PKG/bin" "$PKG/dist"
      cp -f "$ENGINE_BIN" "$PKG/bin/morph-engine"
      cp -f "$ENGINE_BIN" "$PKG/dist/morph"
      ok "Standalone engine: $ENGINE_BIN"
    else
      warn "Binary build finished but morph-engine not found — will use bun runtime"
    fi
  else
    warn "Binary build failed — Morph will use bun + branded source (still works)"
  fi
else
  info "Skipping binary build (MORPH_BUILD_BINARY=0)"
fi

# PATH wrapper — always the stable entrypoint
cat > "$BIN_DIR/morph" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export PATH="\$HOME/.bun/bin:\$HOME/.local/bin:\$PATH"
export MORPH_HOME="$PKG"
exec bash "$PKG/bin/morph" "\$@"
EOF
chmod +x "$BIN_DIR/morph"
ok "Installed $BIN_DIR/morph"

# Seed config via doctor
export MORPH_HOME="$PKG"
export PATH="$BIN_DIR:$HOME/.bun/bin:$PATH"
if bash "$PKG/bin/morph" doctor >/tmp/morph-doctor.out 2>&1; then
  ok "morph doctor OK"
else
  # doctor may warn without binary; show output but don't fail hard if config seeded
  if [[ -f "$HOME/.config/morph/morph.jsonc" || -f "$HOME/.config/morph/morph.json" ]]; then
    warn "morph doctor reported issues (see /tmp/morph-doctor.out) — config present"
  else
    cat /tmp/morph-doctor.out >&2
    die "morph doctor failed"
  fi
fi

# PATH hint
if ! echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
  warn "Add to your shell profile:  export PATH=\"$BIN_DIR:\$PATH\""
fi

echo ""
printf '\033[1mDone.\033[0m Morph is ready.\n\n'
echo "  Setup (copy-paste)"
echo "  ────────────────────────────────────────────────────────────"
echo "  # install (this machine)"
echo "  curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash"
echo ""
echo "  # account + workspace"
echo "  morph login"
echo "  morph workspaces          # list"
echo "  morph use <workspaceId>   # optional projectId"
echo "  cd your-app && morph bind"
echo "  morph                     # TUI — no re-brand if engine is stamped/binary"
echo "  morph providers add codexin"
echo ""
if [[ -n "$ENGINE_BIN" ]]; then
  echo "  Engine: standalone binary (fast start)"
else
  echo "  Engine: bun + branded source (stamped — no re-brand each run)"
  echo "  Optional: MORPH_BUILD_BINARY=1 bash $PKG/install.sh"
fi
echo "  Config:  ~/.config/morph"
echo "  Session: ~/.local/share/morph/zexvro-auth.json"
echo ""
