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

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found on PATH" >&2
  exit 1
fi

rm -rf .venv-transcription
python3 -m venv .venv-transcription
.venv-transcription/bin/python -m pip install -U pip setuptools wheel
.venv-transcription/bin/pip install -r scripts/requirements-transcription.txt
echo "Installed into $ROOT/.venv-transcription. Set TRANSCRIPTION_PROVIDER=faster-whisper (see .env.example)."
