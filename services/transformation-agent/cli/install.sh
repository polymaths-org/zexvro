#!/bin/bash
# install.sh - Installer for Morph CLI agent

set -e

# Get absolute path of this script's directory
CLI_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=== Morph CLI Agent Installation ==="
echo "Target Directory: $CLI_DIR"

# 1. Create virtual environment if it doesn't exist
if [ ! -f "$CLI_DIR/bin/python" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$CLI_DIR"
fi

# 2. Upgrade pip and install requirements
echo "Installing dependencies..."
"$CLI_DIR/bin/python" -m pip install --upgrade pip
"$CLI_DIR/bin/python" -m pip install -r "$CLI_DIR/requirements.txt"

# 3. Create ~/.local/bin if it doesn't exist
mkdir -p "$HOME/.local/bin"

# 4. Create the 'morph' wrapper script
LAUNCHER_PATH="$HOME/.local/bin/morph"
echo "Creating launcher at: $LAUNCHER_PATH"

cat << EOF > "$LAUNCHER_PATH"
#!/bin/bash
export PYTHONPATH="$CLI_DIR:\$PYTHONPATH"
exec "$CLI_DIR/bin/python" "$CLI_DIR/morph.py" "\$@"
EOF

chmod +x "$LAUNCHER_PATH"

echo "=== Installation Completed ==="
echo "You can now run the agent by typing: morph"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo "⚠️  WARNING: '$HOME/.local/bin' is not in your PATH environment variable."
    echo "To fix this, add the following line to your ~/.bashrc or ~/.zshrc file:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "Then reload your shell: source ~/.bashrc (or source ~/.zshrc)"
fi
