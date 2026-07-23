#!/usr/bin/env bash
# Morph one-command install
#   bash services/morph/install.sh
#   curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/services/morph/install.sh | bash
set -euo pipefail

REPO_URL="${MORPH_REPO_URL:-https://github.com/polymaths-org/zexvro}"
BRANCH="${MORPH_BRANCH:-main}"
INSTALL_DIR="${MORPH_INSTALL_DIR:-$HOME/.local/share/morph}"
BIN_DIR="${MORPH_BIN_DIR:-$HOME/.local/bin}"

ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
info() { printf '· %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

printf '\n\033[1m  MORPH  ·  ZEXVRO transformation agent\033[0m\n'
info "install → $INSTALL_DIR"
info "command → $BIN_DIR/morph"
echo ""

command -v node >/dev/null 2>&1 || die "Node.js 22+ required"
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[[ "$NODE_MAJOR" -ge 22 ]] || die "Node.js 22+ required (found $(node -v))"
ok "Node $(node -v)"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$SCRIPT_DIR/bin/morph.mjs" ]]; then
    rm -rf "$INSTALL_DIR/package"
    ln -sfn "$SCRIPT_DIR" "$INSTALL_DIR/package"
    ok "Linked local Morph sources"
  fi
fi

if [[ ! -e "$INSTALL_DIR/package/bin/morph.mjs" ]]; then
  command -v git >/dev/null 2>&1 || die "git required to fetch Morph"
  info "Fetching Morph from $REPO_URL…"
  TMP=$(mktemp -d)
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1 \
    || git clone --depth 1 "$REPO_URL" "$TMP/zexvro" >/dev/null 2>&1
  rm -rf "$INSTALL_DIR/package"
  mkdir -p "$INSTALL_DIR/package"
  cp -a "$TMP/zexvro/services/morph/." "$INSTALL_DIR/package/"
  rm -rf "$TMP"
  ok "Morph package installed"
fi

# verify node can load entry
node --check "$INSTALL_DIR/package/bin/morph.mjs" || die "Morph entrypoint failed syntax check"
node --check "$INSTALL_DIR/package/src/tui.mjs" || die "Morph TUI failed syntax check"
node --check "$INSTALL_DIR/package/src/cli.mjs" || die "Morph CLI failed syntax check"
ok "Syntax checks passed"

cat > "$BIN_DIR/morph" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export PATH="\$HOME/.local/bin:\$PATH"
exec node "$INSTALL_DIR/package/bin/morph.mjs" "\$@"
EOF
chmod +x "$BIN_DIR/morph"
ok "Installed $BIN_DIR/morph"

case ":$PATH:" in
  *":$BIN_DIR:"*) ok "PATH includes $BIN_DIR" ;;
  *)
    for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
      if [[ -f "$rc" ]] && ! grep -q 'MORPH_BIN_PATH' "$rc" 2>/dev/null; then
        printf '\n# MORPH_BIN_PATH\nexport PATH="%s:\$PATH"\n' "$BIN_DIR" >> "$rc"
        ok "Added PATH to $rc"
        break
      fi
    done
    export PATH="$BIN_DIR:$PATH"
    ;;
esac

# smoke: doctor must not crash
if ! node "$INSTALL_DIR/package/bin/morph.mjs" doctor >/dev/null 2>&1; then
  die "morph doctor failed after install — report this"
fi
ok "morph doctor OK"

echo ""
printf '\033[1mDone.\033[0m\n\n'
echo "  morph"
echo ""
echo "  Then:  /connect"
echo "  (OpenAI · Anthropic-compatible · custom endpoint · API key · model)"
echo ""
