#!/usr/bin/env bash
# One-command Morph install.
#   curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/services/morph/install.sh | bash
#   # or from a zexvro checkout:
#   bash services/morph/install.sh
set -euo pipefail

MORPH_VERSION="0.3.0"
REPO_URL="${MORPH_REPO_URL:-https://github.com/polymaths-org/zexvro}"
BRANCH="${MORPH_BRANCH:-main}"
INSTALL_DIR="${MORPH_INSTALL_DIR:-$HOME/.local/share/morph}"
BIN_DIR="${MORPH_BIN_DIR:-$HOME/.local/bin}"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
info() { printf '· %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

bold ""
bold "  MORPH  ·  ZEXVRO transformation agent"
info "install dir: $INSTALL_DIR"
info "bin:         $BIN_DIR/morph"
echo ""

# --- Node ---
if ! command -v node >/dev/null 2>&1; then
  die "Node.js 22+ is required. Install Node then re-run."
fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  die "Node.js 22+ required (found $(node -v))"
fi
ok "Node $(node -v)"

# --- OpenCode TUI engine (Morph uses it; you only ever type morph) ---
if command -v opencode >/dev/null 2>&1; then
  ok "OpenCode $(opencode --version 2>/dev/null | head -1 || echo present)"
else
  info "Installing OpenCode TUI engine…"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://opencode.ai/install | bash
  elif command -v npm >/dev/null 2>&1; then
    npm i -g opencode-ai@latest
  else
    die "Need curl or npm to install OpenCode"
  fi
  # ensure PATH for this session
  export PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH"
  command -v opencode >/dev/null 2>&1 || die "OpenCode install finished but 'opencode' not on PATH. Open a new shell and re-run."
  ok "OpenCode installed"
fi

# --- Morph package files ---
mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if [[ -f "${BASH_SOURCE[0]:-}" ]]; then
  # Running from a local checkout
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$SCRIPT_DIR/bin/morph.mjs" ]]; then
    info "Using local Morph sources: $SCRIPT_DIR"
    # Prefer symlink so monorepo edits apply immediately
    rm -rf "$INSTALL_DIR/package"
    ln -sfn "$SCRIPT_DIR" "$INSTALL_DIR/package"
  fi
fi

if [[ ! -e "$INSTALL_DIR/package/bin/morph.mjs" ]]; then
  info "Fetching Morph from $REPO_URL ($BRANCH)…"
  TMP=$(mktemp -d)
  if command -v git >/dev/null 2>&1; then
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1 \
      || git clone --depth 1 "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1
    rm -rf "$INSTALL_DIR/package"
    mkdir -p "$INSTALL_DIR/package"
    cp -a "$TMP/zexvro/services/morph/." "$INSTALL_DIR/package/"
  else
    die "git required to fetch Morph sources"
  fi
  rm -rf "$TMP"
fi
ok "Morph package ready"

# --- Launcher on PATH ---
cat > "$BIN_DIR/morph" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export PATH="\$HOME/.opencode/bin:\$HOME/.local/bin:\$PATH"
exec node "$INSTALL_DIR/package/bin/morph.mjs" "\$@"
EOF
chmod +x "$BIN_DIR/morph"
ok "Installed $BIN_DIR/morph"

# --- Branding assets into OpenCode config ---
node "$INSTALL_DIR/package/bin/morph.mjs" setup-assets >/dev/null 2>&1 || true
ok "Morph theme + agents registered"

# --- PATH hint ---
case ":$PATH:" in
  *":$BIN_DIR:"*) ok "PATH already includes $BIN_DIR" ;;
  *)
    warn_line="Add to your shell profile:  export PATH=\"$BIN_DIR:\$PATH\""
    printf '\033[33m!\033[0m %s\n' "$warn_line"
    # best-effort append for zsh/bash
    for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
      if [[ -f "$rc" ]] && ! grep -q 'MORPH_BIN_PATH' "$rc" 2>/dev/null; then
        {
          echo ""
          echo "# MORPH_BIN_PATH"
          echo "export PATH=\"$BIN_DIR:\$PATH\""
        } >> "$rc"
        ok "Appended PATH to $rc (new shells)"
        break
      fi
    done
    export PATH="$BIN_DIR:$PATH"
    ;;
esac

echo ""
bold "Done. Start Morph:"
echo ""
echo "  morph"
echo ""
echo "In the TUI:  /connect   (or /provider) to add OpenAI / Anthropic / custom endpoints"
echo "Workspace:   cd your-game-or-repo && morph"
echo ""
echo "Demo game:   https://bright-meadow-20f31c35f5.lakebed.app"
echo ""
