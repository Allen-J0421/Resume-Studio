#!/bin/bash

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_URL="http://127.0.0.1:4319"

pause_on_error() {
  status=$?
  printf '\nSetup stopped because a command failed. The error is shown above.\n'
  read -r -p 'Press Return to close this window. ' _
  exit "$status"
}
trap pause_on_error ERR

if [ "$(uname -s)" != "Darwin" ]; then
  printf 'This setup file is for macOS only.\n'
  exit 1
fi

printf '\nSetting up Résumé-Studio for macOS…\n\n'

installed_homebrew=false
if ! command -v brew >/dev/null 2>&1; then
  printf 'Installing Homebrew…\n'
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  installed_homebrew=true
fi

if [ -x /opt/homebrew/bin/brew ]; then
  BREW_BIN=/opt/homebrew/bin/brew
elif [ -x /usr/local/bin/brew ]; then
  BREW_BIN=/usr/local/bin/brew
fi

if [ -n "$BREW_BIN" ]; then
  eval "$("$BREW_BIN" shellenv)"
fi

# Finish the Homebrew installation the way Homebrew itself asks, but only when
# this file installed it. An existing Homebrew is left exactly as configured.
if [ "$installed_homebrew" = true ] && [ -n "$BREW_BIN" ] \
  && ! grep -qs 'brew shellenv' "$HOME/.zprofile"; then
  printf '\neval "$(%s shellenv)"\n' "$BREW_BIN" >> "$HOME/.zprofile"
  printf 'Added Homebrew to your terminal path in ~/.zprofile.\n'
fi

node_major=0
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
fi
if [ "$node_major" -lt 20 ]; then
  printf '\nInstalling Node.js…\n'
  brew install node
fi

export PATH="/Library/TeX/texbin:$PATH"
if ! command -v latexmk >/dev/null 2>&1 || ! command -v xelatex >/dev/null 2>&1; then
  printf '\nInstalling MacTeX. This is a large download and can take several minutes…\n'
  brew install --cask mactex-no-gui
  export PATH="/Library/TeX/texbin:$PATH"
fi

if ! open -Ra "Visual Studio Code" >/dev/null 2>&1; then
  printf '\nInstalling Visual Studio Code…\n'
  brew install --cask visual-studio-code
fi

VSCODE_APP="$(osascript -e 'POSIX path of (path to application id "com.microsoft.VSCode")' 2>/dev/null || true)"
[ -n "$VSCODE_APP" ] || VSCODE_APP="/Applications/Visual Studio Code.app"
VSCODE_APP="${VSCODE_APP%/}"
VSCODE_CLI="$VSCODE_APP/Contents/Resources/app/bin/code"

chmod +x "$PROJECT_DIR/scripts/start-server.sh" 2>/dev/null || true

printf '\nSetup complete. Opening the Résumé-Studio folder in Visual Studio Code…\n'

if curl -fsS --max-time 1 "$SERVER_URL/status" >/dev/null 2>&1; then
  printf 'Résumé-Studio is already running at %s\n' "$SERVER_URL"
  open -a "$VSCODE_APP" "$PROJECT_DIR"
else
  # --disable-workspace-trust applies to this window only. It does not change
  # any saved Visual Studio Code setting, and it lets the Résumé-Studio task run
  # without a trust question first.
  if [ -x "$VSCODE_CLI" ]; then
    "$VSCODE_CLI" --new-window --disable-workspace-trust "$PROJECT_DIR" >/dev/null 2>&1 \
      || open -a "$VSCODE_APP" "$PROJECT_DIR"
  else
    open -a "$VSCODE_APP" "$PROJECT_DIR"
  fi
fi

printf '\nIn Visual Studio Code, press Command+Shift+B.\n'
printf 'That task starts Résumé-Studio and opens its integrated browser view.\n'

read -r -p 'Press Return to close this setup window. ' _
