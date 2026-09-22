#!/bin/bash

# Starts the Résumé-Studio server for the Visual Studio Code task. That task runs
# in a shell that does not always load the settings of a normal terminal, so
# this script looks in the usual places for Node.js and TeX before starting.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

for directory in /opt/homebrew/bin /usr/local/bin /Library/TeX/texbin; do
  if [ -d "$directory" ]; then
    case ":$PATH:" in
      *":$directory:"*) ;;
      *) PATH="$PATH:$directory" ;;
    esac
  fi
done
export PATH

if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js was not found. Double-click setup.command in the Résumé-Studio folder first.\n'
  exit 1
fi

cd "$PROJECT_DIR"
exec node server.mjs "$@"
