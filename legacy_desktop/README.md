# DeChord Legacy Desktop

This folder contains the original PyQt5 desktop application and the compatibility helpers it still uses for chord analysis, audio runtime, caching, timeline lookup, and export formatting. The modern Tauri/React app and local backend live in `frontend/` and `backend/`.

## Run

Run it from the repository root:

```bat
run.bat
```

On Linux/macOS:

```bash
./run.sh
```

Launch scripts intentionally stay at the repository root. They use the shared root `venv`, install `legacy_desktop/requirements.txt` into that environment, and start `legacy_desktop/main.py`.
