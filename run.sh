#!/usr/bin/env bash
set -euo pipefail

# Always run from the script's directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

VENV_DIR="$BASE_DIR/venv"
REQ_FILE="$BASE_DIR/requirements.txt"
STAMP_FILE="$VENV_DIR/.req_hash"

# Find python
PY=python3
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "[DeChord] ERROR: python3 not found in PATH." >&2
  exit 1
fi

# Create venv if missing
if [ ! -d "$VENV_DIR" ]; then
  echo "[DeChord] Creating virtual environment..."
  "$PY" -m venv "$VENV_DIR"
fi

# Activate venv
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# Always deactivate when the script exits (normal or error)
trap 'deactivate >/dev/null 2>&1 || true' EXIT

# Keep tooling fresh (quietly)
python -m pip install --upgrade pip setuptools wheel >/dev/null

# Compute a stamp from Python/pip versions + requirements content
calc_hash() {
  if [ -f "$REQ_FILE" ]; then
    ( python -V; pip -V; cat "$REQ_FILE" ) | sha256sum | awk '{print $1}'
  else
    ( python -V; pip -V ) | sha256sum | awk '{print $1}'
  fi
}

NEWHASH="$(calc_hash)"
OLDHASH="$( [ -f "$STAMP_FILE" ] && cat "$STAMP_FILE" || echo )"

# Install only if first run or something changed
if [ ! -f "$STAMP_FILE" ] || [ "$NEWHASH" != "$OLDHASH" ]; then
  if [ -f "$REQ_FILE" ]; then
    echo "[DeChord] Installing / verifying dependencies..."
    echo "[DeChord] Please do not close the terminal until installation finishes."
    pip install -r "$REQ_FILE"
  fi
  # Write stamp only after successful install to avoid half-installed state
  echo "$NEWHASH" > "$STAMP_FILE"
else
  echo "[DeChord] Dependencies already satisfied. Skipping install."
fi

echo "[DeChord] Starting app..."
python "$BASE_DIR/main.py"
STATUS=$?

# (trap will deactivate the venv)
exit $STATUS