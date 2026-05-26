#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="DeChord Legacy"
DESKTOP_FILE_NAME="dechord-legacy.desktop"
DESKTOP_FILE_CONTENT="[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=Launch ${APP_NAME}
Exec=\"${PROJECT_DIR}/run.sh\"
Path=${PROJECT_DIR}
Icon=${PROJECT_DIR}/legacy_desktop/icon
Terminal=false
Categories=Audio;Music;Utility;"

APPS_DIR="${HOME}/.local/share/applications"
DESKTOP_DIR="${HOME}/Desktop"

mkdir -p "$APPS_DIR"
mkdir -p "$DESKTOP_DIR"

echo "$DESKTOP_FILE_CONTENT" > "${APPS_DIR}/${DESKTOP_FILE_NAME}"
echo "$DESKTOP_FILE_CONTENT" > "${DESKTOP_DIR}/${APP_NAME}.desktop"

chmod +x "${APPS_DIR}/${DESKTOP_FILE_NAME}" || true
chmod +x "${DESKTOP_DIR}/${APP_NAME}.desktop" || true

echo "[DeChord Legacy] Shortcut created:"
echo "  - ${APPS_DIR}/${DESKTOP_FILE_NAME}"
echo "  - ${DESKTOP_DIR}/${APP_NAME}.desktop"
