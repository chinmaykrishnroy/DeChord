#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="DeChord"
DESKTOP_FILE_NAME="dechord.desktop"
DESKTOP_FILE_CONTENT="[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=Launch ${APP_NAME}
Exec=\"${BASE_DIR}/run.sh\"
Path=${BASE_DIR}
Icon=${BASE_DIR}/icon
Terminal=false
Categories=Audio;Music;Utility;"

# Where to place the shortcut
APPS_DIR="${HOME}/.local/share/applications"
DESKTOP_DIR="${HOME}/Desktop"

mkdir -p "$APPS_DIR"
mkdir -p "$DESKTOP_DIR"

# Write .desktop file to both locations
echo "$DESKTOP_FILE_CONTENT" > "${APPS_DIR}/${DESKTOP_FILE_NAME}"
echo "$DESKTOP_FILE_CONTENT" > "${DESKTOP_DIR}/${APP_NAME}.desktop"

# Make them executable
chmod +x "${APPS_DIR}/${DESKTOP_FILE_NAME}" || true
chmod +x "${DESKTOP_DIR}/${APP_NAME}.desktop" || true

echo "[DeChord] Shortcut created:"
echo "  - ${APPS_DIR}/${DESKTOP_FILE_NAME}"
echo "  - ${DESKTOP_DIR}/${APP_NAME}.desktop"

echo
echo "Tip:"
echo "Run the shortcut only after running run.sh successfully"
echo "Some desktops (e.g., GNOME) will show a 'Untrusted' prompt the first time."
echo "Right-click the Desktop icon → 'Allow Launching' if prompted."
echo "May take few seconds after double clicking the shortcut"