#!/usr/bin/env bash
# Apply Morph branding to an OpenCode source checkout (MIT fork base).
# Usage: apply-branding.sh /path/to/opencode-checkout
set -euo pipefail

ROOT="${1:?path to opencode source}"
PATCH_DIR="$(cd "$(dirname "$0")/patches" && pwd)"

[[ -d "$ROOT/packages/tui/src" ]] || { echo "not an opencode tree: $ROOT" >&2; exit 1; }

if [[ "${MORPH_BRAND_QUIET:-0}" != "1" ]]; then
  echo "· branding Morph → $ROOT"
fi

# Record stamp so `morph` can skip re-brand on every launch (see bin/morph needs_rebrand)
stamp_brand() {
  local stamp_file="$ROOT/.morph-brand-stamp"
  {
    echo "branded_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "root=$ROOT"
  } >"$stamp_file" 2>/dev/null || true
}

# 1) Splash logo (Morph wordmark) — all copies
cp "$PATCH_DIR/logo.ts" "$ROOT/packages/tui/src/logo.ts"
# Morph Logo component (single primary wordmark)
if [[ -f "$PATCH_DIR/logo.tsx" && -f "$ROOT/packages/tui/src/component/logo.tsx" ]]; then
  cp "$PATCH_DIR/logo.tsx" "$ROOT/packages/tui/src/component/logo.tsx"
fi
# TUI presentation wordmark (keep in sync with logo.ts)
if [[ -f "$ROOT/packages/tui/src/util/presentation.ts" ]]; then
  python3 - "$ROOT/packages/tui/src/util/presentation.ts" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
t = p.read_text()
new = '''const logo = {
  left: [
    "                            ",
    "█▀▄▀█  █▀▀█  █▀▀█  █▀▀█  █  █",
    "█ █ █  █  █  █▀▀▄  █▀▀▀  █▀▀█",
    "▀   ▀  ▀▀▀▀  ▀  ▀  ▀     ▀  ▀",
  ],
  right: ["", "", "", ""],
}'''
t = re.sub(r"const logo = \{[\s\S]*?\n\}", new, t, count=1)
t = t.replace("opencode -s", "morph -s")
p.write_text(t)
PY
fi
# CLI help/banner wordmark (same art)
if [[ -f "$ROOT/packages/opencode/src/cli/ui.ts" ]]; then
  python3 - "$ROOT/packages/opencode/src/cli/ui.ts" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
t = p.read_text()
t2 = re.sub(
    r"const wordmark = \[[\s\S]*?\]",
    """const wordmark = [
  `                              `,
  `█▀▄▀█  █▀▀█  █▀▀█  █▀▀█  █  █`,
  `█ █ █  █  █  █▀▀▄  █▀▀▀  █▀▀█`,
  `▀   ▀  ▀▀▀▀  ▀  ▀  ▀     ▀  ▀`,
]""",
    t,
    count=1,
)
p.write_text(t2)
PY
fi

# 2) XDG app name: ~/.config/morph, ~/.local/share/morph, …
if [[ -f "$ROOT/packages/core/src/global.ts" ]]; then
  sed -i 's/const app = "opencode"/const app = "morph"/' "$ROOT/packages/core/src/global.ts"
fi

# 2b) CLI process name: morph not opencode
if [[ -f "$ROOT/packages/opencode/src/index.ts" ]]; then
  sed -i 's/\.scriptName("opencode")/.scriptName("morph")/' "$ROOT/packages/opencode/src/index.ts"
fi

# 3) Config filenames — surgical (do NOT touch theme assets)
#    opencode.json / opencode.jsonc → morph.json / morph.jsonc
#    .opencode → .morph  (project config dir)
brand_file() {
  local f="$1"
  # skip theme asset paths / binary blobs
  case "$f" in
    */theme/assets/*|*/node_modules/*|*/.git/*|*/dist/*) return 0 ;;
  esac
  # skip the theme index import of the built-in theme file name unless we handle it
  if [[ "$f" == *"/theme/index.ts" ]]; then
    # leave assets/opencode.json import; Morph theme ships via user config tui.json
    return 0
  fi
  if grep -qE 'opencode\.jsonc|opencode\.json|\.opencode' "$f" 2>/dev/null; then
    # Only replace config *filenames* and project dir — not arbitrary "opencode" words
    sed -i \
      -e 's/"opencode\.jsonc"/"morph.jsonc"/g' \
      -e "s/'opencode\.jsonc'/'morph.jsonc'/g" \
      -e 's/"opencode\.json"/"morph.json"/g' \
      -e "s/'opencode\.json'/'morph.json'/g" \
      -e 's/`opencode\.jsonc`/`morph.jsonc`/g' \
      -e 's/`opencode\.json`/`morph.json`/g' \
      -e 's/opencode\.jsonc/morph.jsonc/g' \
      -e 's/opencode\.json/morph.json/g' \
      -e 's/"\.opencode"/".morph"/g' \
      -e "s/'\.opencode'/'.morph'/g" \
      -e 's/`\.opencode`/`.morph`/g' \
      -e 's/\.opencode\//.morph\//g' \
      "$f" || true
  fi
}

while IFS= read -r -d '' f; do
  brand_file "$f"
done < <(find "$ROOT/packages/core/src" "$ROOT/packages/opencode/src" \
  -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.txt' \) -print0 2>/dev/null)

# 4) CLI user-facing OpenCode → Morph (titles only, not package ids)
while IFS= read -r -d '' f; do
  case "$f" in
    */theme/*) continue ;;
  esac
  if grep -q 'OpenCode' "$f" 2>/dev/null; then
    sed -i -e 's/OpenCode/Morph/g' "$f" || true
  fi
done < <(find "$ROOT/packages/opencode/src/cli" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 2>/dev/null)

# 5) Ship Morph built-in theme next to stock themes (optional name "morph")
if [[ -d "$ROOT/packages/tui/src/theme/assets" && -f "$PATCH_DIR/../../seed/themes/morph.json" ]]; then
  cp "$PATCH_DIR/../../seed/themes/morph.json" "$ROOT/packages/tui/src/theme/assets/morph.json" || true
fi

# 6) /connect: CodexIn built-in under Popular + custom endpoint polish
if [[ -f "$ROOT/packages/tui/src/component/dialog-provider.tsx" ]]; then
  python3 - "$ROOT/packages/tui/src/component/dialog-provider.tsx" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text()
repls = [
(
'''const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
}''',
'''const PROVIDER_PRIORITY: Record<string, number> = {
  codexin: 0,
  opencode: 1,
  "opencode-go": 2,
  openai: 3,
  "github-copilot": 4,
  anthropic: 5,
  google: 6,
}''',
),
(
'''        description: {
          opencode: "(Recommended)",
          anthropic: "(API key)",
          openai: "(ChatGPT Plus/Pro or API key)",
          "opencode-go": "Low cost subscription for everyone",
        }[provider.id],''',
'''        description: {
          codexin: "Grok 4.5 via CodexIn (API key)",
          opencode: "(Recommended)",
          anthropic: "(API key)",
          openai: "(ChatGPT Plus/Pro or API key)",
          "opencode-go": "Low cost subscription for everyone",
        }[provider.id],''',
),
(
'''    {
      type: "custom",
      title: "Other",
      value: CUSTOM_PROVIDER_OPTION_VALUE,
      description: "Custom provider",
      category: "Providers",
    },''',
'''    {
      type: "custom",
      title: "Custom endpoint",
      value: CUSTOM_PROVIDER_OPTION_VALUE,
      description: "OpenAI-compatible base URL + API key",
      category: "Popular",
    },''',
),
(
'''    const value = await DialogPrompt.show(dialog, "Other", {
      placeholder: "Provider id",
      description: () => (
        <text fg={theme.textMuted}>
          This only stores a credential. Configure the provider in morph.json to use it.
        </text>
      ),
    })''',
'''    const value = await DialogPrompt.show(dialog, "Custom endpoint", {
      placeholder: "provider-id (e.g. my-proxy)",
      description: () => (
        <text fg={theme.textMuted}>
          Id only (a-z, 0-9, - _). Then enter API key. Base URL + model: morph providers add
        </text>
      ),
    })''',
),
(
'''          toast.show({
            variant: "info",
            message: `Saved credential for ${props.providerID}. Configure it in morph.json to use it.`,
          })''',
'''          toast.show({
            variant: "info",
            message: `Saved key for ${props.providerID}. Run: morph providers add (baseURL + models)`,
          })''',
),
]
for a, b in repls:
    if a in t:
        t = t.replace(a, b)
# Idempotent: if already branded once, ensure codexin still present
if 'codexin: 0' not in t and 'PROVIDER_PRIORITY' in t:
    t = t.replace(
        'const PROVIDER_PRIORITY: Record<string, number> = {\n  opencode: 0,',
        'const PROVIDER_PRIORITY: Record<string, number> = {\n  codexin: 0,\n  opencode: 1,',
        1,
    )
if 'codexin: "Grok' not in t and 'description: {' in t:
    t = t.replace(
        'description: {\n          opencode: "(Recommended)",',
        'description: {\n          codexin: "Grok 4.5 via CodexIn (API key)",\n          opencode: "(Recommended)",',
        1,
    )
p.write_text(t)
PY
fi

# 7) ZEXVRO workspace picker — native /use /bind /zexvro inside TUI
ZEXVRO_USE_SRC="$PATCH_DIR/feature-zexvro-use.tsx"
ZEXVRO_USE_DST="$ROOT/packages/tui/src/feature-plugins/zexvro/use.tsx"
BUILTINS="$ROOT/packages/tui/src/feature-plugins/builtins.ts"
if [[ -f "$ZEXVRO_USE_SRC" && -f "$BUILTINS" ]]; then
  mkdir -p "$(dirname "$ZEXVRO_USE_DST")"
  cp "$ZEXVRO_USE_SRC" "$ZEXVRO_USE_DST"
  python3 - "$BUILTINS" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text()
if 'from "./zexvro/use"' not in t and "from './zexvro/use'" not in t:
    # insert after last import line
    lines = t.splitlines(True)
    last_imp = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            last_imp = i
    lines.insert(last_imp + 1, 'import ZexvroUse from "./zexvro/use"\n')
    t = "".join(lines)
if "ZexvroUse" not in t:
    raise SystemExit("failed to add ZexvroUse import")
# ensure plugin is in createBuiltinPlugins list
if "ZexvroUse," not in t and "ZexvroUse\n" not in t:
    if "DiffViewer," in t:
        t = t.replace("DiffViewer,", "DiffViewer,\n    ZexvroUse,", 1)
    elif "DiffViewer\n" in t:
        t = t.replace("DiffViewer\n", "DiffViewer,\n    ZexvroUse\n", 1)
    else:
        raise SystemExit("could not find DiffViewer in builtins list")
p.write_text(t)
print("  · registered ZexvroUse plugin (/use /bind /zexvro)")
PY
fi

echo "morph-branded $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ROOT/.morph-branded"
# Content stamp filled by morph launcher (brand_inputs_hash) after this script
touch "$ROOT/.morph-brand-stamp" 2>/dev/null || true
if [[ "${MORPH_BRAND_QUIET:-0}" != "1" ]]; then
  echo "✓ Morph branding applied"
fi
