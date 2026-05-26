# DeChord Legacy Desktop

This folder contains the original PyQt5 desktop application. The modern Tauri/React app and local backend now live in `frontend/` and `backend/`, while this app is kept here for reference and maintenance.

## Run

From the repository root:

```bat
run.bat
```

Or directly from this folder:

```bat
legacy_desktop\run.bat
```

On Linux/macOS:

```bash
./run.sh
```

The legacy scripts create their own virtual environment inside `legacy_desktop/venv`, install `legacy_desktop/requirements.txt`, and add the repository root to `PYTHONPATH` so shared analysis helpers can still be imported.
