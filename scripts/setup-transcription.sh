#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script targets macOS Homebrew Python + expat. On Linux, use: python3 -m venv .venv-transcription && .venv-transcription/bin/pip install -r scripts/requirements-transcription.txt" >&2
fi

BREW_PREFIX="${HOMEBREW_PREFIX:-}"
if [[ -z "$BREW_PREFIX" ]]; then
  if [[ "$(uname -m)" == "arm64" ]]; then BREW_PREFIX="/opt/homebrew"; else BREW_PREFIX="/usr/local"; fi
fi
export DYLD_LIBRARY_PATH="${BREW_PREFIX}/opt/expat/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  for candidate in python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$PYTHON_BIN" ]]; then
  echo "No python3.12, python3.11, or python3 found on PATH" >&2
  exit 1
fi

echo "Using $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"
rm -rf .venv-transcription
"$PYTHON_BIN" -m venv .venv-transcription
.venv-transcription/bin/python -m pip install -U pip setuptools wheel
.venv-transcription/bin/pip install -r scripts/requirements-transcription.txt
VENV_PY="$ROOT/.venv-transcription/bin/python"
echo "Installed into $ROOT/.venv-transcription."
echo "Add to .env.local:"
echo "FASTER_WHISPER_PYTHON=$VENV_PY"
echo "TRANSCRIPTION_PROVIDER=faster-whisper"
