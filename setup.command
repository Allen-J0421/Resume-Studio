#!/bin/bash

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

printf '\nSetting up auto-resume for macOS…\n\n'

if ! command -v brew >/dev/null 2>&1; then
  printf 'Installing Homebrew…\n'
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
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

SERVER_URL="http://127.0.0.1:4319"
SERVER_LOG="${TMPDIR:-/tmp}/auto-resume.log"

if ! curl -fsS --max-time 1 "$SERVER_URL/source" >/dev/null 2>&1; then
  printf '\nStarting auto-resume…\n'
  cd "$PROJECT_DIR"
  nohup node server.mjs >"$SERVER_LOG" 2>&1 &

  server_ready=false
  for _ in {1..30}; do
    if curl -fsS --max-time 1 "$SERVER_URL/source" >/dev/null 2>&1; then
      server_ready=true
      break
    fi
    sleep 1
  done

  if [ "$server_ready" != true ]; then
    printf '\nauto-resume did not start. Server log:\n\n'
    cat "$SERVER_LOG"
    exit 1
  fi
fi

printf '\nSetup complete. Opening auto-resume in Visual Studio Code…\n'
open -a "Visual Studio Code" "$PROJECT_DIR"

printf '\nauto-resume is running at %s\n' "$SERVER_URL"
printf 'If the editor is not already visible, press Command+Shift+B in Visual Studio Code.\n'
read -r -p 'Press Return to close this setup window. ' _
