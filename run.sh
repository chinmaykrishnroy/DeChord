#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

VENV_DIR="$PROJECT_DIR/venv"
REQ_FILE="$PROJECT_DIR/legacy_desktop/requirements.txt"
STAMP_FILE="$VENV_DIR/.legacy_req_hash"
LEGACY_APP="$PROJECT_DIR/legacy_desktop/main.py"

PY=python3
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "[DeChord Legacy] ERROR: python3 not found in PATH." >&2
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "[DeChord Legacy] Creating shared virtual environment..."
  "$PY" -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
trap 'deactivate >/dev/null 2>&1 || true' EXIT

export PYTHONPATH="$PROJECT_DIR:$PROJECT_DIR/legacy_desktop:${PYTHONPATH:-}"

python -m pip install --upgrade pip wheel "setuptools<82" >/dev/null

calc_hash() {
  ( python -V; python -m pip -V; cat "$REQ_FILE" ) | sha256sum | awk '{print $1}'
}

NEWHASH="$(calc_hash)"
OLDHASH="$( [ -f "$STAMP_FILE" ] && cat "$STAMP_FILE" || echo )"

if [ ! -f "$STAMP_FILE" ] || [ "$NEWHASH" != "$OLDHASH" ]; then
  echo "[DeChord Legacy] Installing / verifying legacy dependencies in shared venv..."
  python -m pip install -r "$REQ_FILE"
  echo "$NEWHASH" > "$STAMP_FILE"
else
  echo "[DeChord Legacy] Dependencies already satisfied. Skipping install."
fi

echo "[DeChord Legacy] Preparing audio decoder..."
if ! python -c "from legacy_desktop.audio_runtime import ensure_ffmpeg_available; raise SystemExit(0 if ensure_ffmpeg_available() else 1)"; then
  echo "[DeChord Legacy] WARNING: FFmpeg could not be prepared. MP3/M4A/AAC analysis may fail."
fi

echo "[DeChord Legacy] Starting PyQt5 app..."
python "$LEGACY_APP"
