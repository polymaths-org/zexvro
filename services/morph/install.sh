#!/usr/bin/env bash
# Morph install — self-contained package (OpenCode fork + ZEXVRO skills/MCP)
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

print_ascii_banner() {
  local banner=""
  # Prefer package-relative banner (works for local + cloned package)
  local candidates=()
  if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    candidates+=("$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/assets/banner.txt")
  fi
  [[ -n "${MORPH_PACKAGE_SRC:-}" ]] && candidates+=("$MORPH_PACKAGE_SRC/assets/banner.txt")
  candidates+=("$INSTALL_DIR/package/assets/banner.txt")

  local f
  for f in "${candidates[@]}"; do
    if [[ -f "$f" ]]; then
      banner="$(cat "$f")"
      break
    fi
  done

  printf '\n'
  if [[ -n "$banner" ]]; then
    # Cyan brand mark
    while IFS= read -r line || [[ -n "$line" ]]; do
      printf '\033[36m%s\033[0m\n' "$line"
    done <<< "$banner"
  else
    # Fallback compact mark (always works, no file deps)
    printf '\033[36m%s\033[0m\n' \
      '  █████                                    █████' \
      '  ████████                              ████████' \
      '  ███████████                        ███████████' \
      '  ██████████████                 ███████████████' \
      '  ██████████████████          ██████████████████' \
      '  █████████████████████    █████████████████████' \
      '  █████████     ████████  ████████    ██████████' \
      '  █████████        █████  █████       ██████████' \
      '  ███████████                        ███████████' \
      '  ██████████████   ███      ███   ██████████████' \
      '      ███████████               ███████████' \
      '         ████████                ████████' \
      '            █████                ████'
  fi
  printf '\n'
  printf '  \033[1mMORPH\033[0m  ·  ZEXVRO transformation agent\n'
  printf '  Web2 → Web3  ·  Gate · NFT · De-pin\n'
  printf '\n'
}

validate_package() {
  local root="$1"
  local missing=()
  local required=(
    bin/morph
    engine/VERSION
    engine/apply-branding.sh
    engine/prepare-src.sh
    engine/patches/logo.ts
    engine/patches/logo.tsx
    seed/morph.jsonc
    seed/tui.json
    seed/AGENTS.md
    seed/agents/morph.md
    seed/themes/morph.json
    seed/skills/web2-web3/SKILL.md
    lib/zexvro-store.mjs
    lib/zexvro-cli.mjs
    lib/paths.mjs
    mcp/src/index.mjs
    package.json
  )
  # Prefer manifest when present
  if [[ -f "$root/PACKAGE.manifest" ]]; then
    mapfile -t required < <(grep -vE '^\s*(#|$)' "$root/PACKAGE.manifest" || true)
  fi
  local rel
  for rel in "${required[@]}"; do
    [[ -z "$rel" ]] && continue
    if [[ ! -e "$root/$rel" ]]; then
      missing+=("$rel")
    fi
  done
  if ((${#missing[@]} > 0)); then
    printf '\033[31m✗ incomplete Morph package at %s\033[0m\n' "$root" >&2
    printf '  missing %d required path(s):\n' "${#missing[@]}" >&2
    local m
    for m in "${missing[@]}"; do
      printf '    - %s\n' "$m" >&2
    done
    printf '\n  This usually means the git branch is missing seed/lib/engine files.\n' >&2
    printf '  Fix: commit services/morph/{seed,lib,engine,bin,assets} and push %s.\n' "$BRANCH" >&2
    exit 1
  fi
}

copy_package_from() {
  local src="$1"
  [[ -d "$src" ]] || die "package source not a directory: $src"
  validate_package "$src"
  rm -rf "$INSTALL_DIR/package"
  mkdir -p "$INSTALL_DIR/package"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a \
      --exclude node_modules \
      --exclude dist \
      --exclude '.src-path' \
      --exclude 'bin/morph-engine' \
      --exclude 'engine/patches/logo-*.png' \
      "$src/" "$INSTALL_DIR/package/"
  else
    cp -a "$src/." "$INSTALL_DIR/package/"
    rm -rf "$INSTALL_DIR/package/node_modules" "$INSTALL_DIR/package/dist" 2>/dev/null || true
    rm -f "$INSTALL_DIR/package/bin/morph-engine" 2>/dev/null || true
    rm -f "$INSTALL_DIR/package/engine/patches"/logo-*.png 2>/dev/null || true
  fi
}

print_ascii_banner
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

# 1) Explicit package source (set by scripts/install-morph.sh after clone)
if [[ -n "${MORPH_PACKAGE_SRC:-}" && -d "${MORPH_PACKAGE_SRC}" ]]; then
  copy_package_from "$MORPH_PACKAGE_SRC"
  ok "Installed Morph package from clone"
# 2) Local monorepo checkout (running services/morph/install.sh in-tree)
elif [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$SCRIPT_DIR/bin/morph" && -f "$SCRIPT_DIR/seed/morph.jsonc" ]]; then
    copy_package_from "$SCRIPT_DIR"
    ln -sfn "$SCRIPT_DIR" "$INSTALL_DIR/package-dev" 2>/dev/null || true
    ok "Installed Morph package from local checkout"
  fi
fi

# 3) Fresh clone from GitHub if package still missing
if [[ ! -f "$INSTALL_DIR/package/bin/morph" || ! -f "$INSTALL_DIR/package/seed/morph.jsonc" ]]; then
  command -v git >/dev/null 2>&1 || die "git required"
  TMP=$(mktemp -d)
  info "Cloning $REPO_URL ($BRANCH)…"
  if git clone --depth 1 --filter=blob:none --sparse --branch "$BRANCH" \
      "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1; then
    (cd "$TMP/zexvro" && git sparse-checkout set services/morph) || true
  else
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1 \
      || git clone --depth 1 "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1 \
      || die "git clone failed"
  fi
  [[ -d "$TMP/zexvro/services/morph" ]] || die "repo has no services/morph"
  copy_package_from "$TMP/zexvro/services/morph"
  rm -rf "$TMP"
  ok "Morph package installed from GitHub"
fi

PKG="$INSTALL_DIR/package"
validate_package "$PKG"
ok "Package manifest OK ($(grep -cvE '^\s*(#|$)' "$PKG/PACKAGE.manifest" 2>/dev/null || echo '?') paths)"

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
    {
      echo "version:$(tr -d '[:space:]' < engine/VERSION 2>/dev/null)"
      cat engine/VERSION 2>/dev/null
      sha256sum engine/apply-branding.sh 2>/dev/null
      find engine/patches -type f 2>/dev/null | sort | while read -r f; do sha256sum "$f"; done
      [[ -f assets/ascii-art.txt ]] && sha256sum assets/ascii-art.txt
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
  if [[ -f "$HOME/.config/morph/morph.jsonc" || -f "$HOME/.config/morph/morph.json" ]]; then
    warn "morph doctor reported issues (see /tmp/morph-doctor.out) — config present"
  else
    cat /tmp/morph-doctor.out >&2
    die "morph doctor failed"
  fi
fi

if ! echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
  warn "Add to your shell profile:  export PATH=\"$BIN_DIR:\$PATH\""
fi

echo ""
printf '\033[1mDone.\033[0m Morph is ready.\n\n'
echo "  Setup (copy-paste)"
echo "  ────────────────────────────────────────────────────────────"
echo "  curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "  morph login"
echo "  morph workspaces"
echo "  morph use <workspaceId>"
echo "  cd your-app && morph bind"
echo "  morph"
echo "  morph providers add codexin"
echo ""
if [[ -n "$ENGINE_BIN" ]]; then
  echo "  Engine: standalone binary (fast start)"
else
  echo "  Engine: bun + branded source (stamped — no re-brand each run)"
fi
echo "  Config:  ~/.config/morph"
echo "  Package: $PKG"
echo ""
