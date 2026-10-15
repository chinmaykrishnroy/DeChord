# DeChord Studio

A local music practice workspace for the browser and Tauri desktop shell. Import a recording, follow its chords, choose guitar voicings, loop a passage, transpose playback, and follow synced lyrics.

## Start

Tested development runtimes: Python 3.10 and Node.js 24. Desktop development also requires Rust and the Tauri platform prerequisites.

From the repository root:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements-backend.txt
.venv\Scripts\python -m pip install -r backend\requirements-analysis.txt
cd frontend
npm ci
cd ..
python scripts/run_studio.py
```

Open [the local web app](http://127.0.0.1:5184). On Windows, `run_web.bat` runs the same launcher. On Linux/macOS use `sh run_studio.sh` after creating `.venv` and installing the requirements with `.venv/bin/python`.

For the desktop shell:

```powershell
python scripts/run_studio.py --desktop
```

`run_app.bat` launches the desktop shell. The launcher starts the backend only if DeChord is not already serving on 8765 and stops the processes it owns on exit. It uses `.venv` first, then the older root `venv` when present. Installing packages is an explicit setup step, not repeated every launch.

`python scripts/run_studio.py --backend-only` runs only the engine. Once `npm run build` has created `frontend/dist`, the backend also serves the built web UI at [port 8765](http://127.0.0.1:8765). The API tester remains at `/tester` and API documentation at `/docs`.

### Analysis engines

- `lv-chordia` is preferred when installed. Current releases with `LVChordiaSession` keep the ensemble loaded between calls. Older releases use their one-shot API.
- An existing compatible madmom installation is supported as the chord fallback and key/tempo engine. It is optional; install its maintained source distribution if desired. It includes native dependencies and may require a compiler.
- Without madmom, the lv-chordia dependency stack's librosa provides shared key-profile and onset-tempo estimates. These estimates do not constitute detected beats or downbeats.
- FFmpeg/ffprobe are required for media import. `static-ffmpeg` can prepare them on first use when absent; that first setup requires internet access.
- `/capabilities` reports installed packages and selected engine IDs. Package availability does not guarantee model accuracy or successful loading for every file.

Environment settings:

| Setting | Purpose |
|---|---|
| `DECHORD_CHORD_ENGINE=madmom` | Select the installed madmom engine explicitly |
| `DECHORD_DATA_DIR` | Override the managed audio/SQLite/work directory; default `cache/backend` |
| `VITE_DECHORD_BACKEND_URL` | Set the frontend API URL at development/build time; default `http://127.0.0.1:8765` |

The service binds to loopback by default. Public hosting needs a separate authentication, deployment, and resource-isolation design; the local API is not a multi-user cloud service.

## Workspace

Use **Customize** to add or hide guitar, piano, lyrics, timeline, chord-sheet, and analysis widgets. Drag their handles and resize their lower-right corners; they snap to a grid. Wide, compact, and narrow layouts are saved separately in the browser. Arrow keys on a focused handle move a widget with collision resolution. Narrow instrument widgets switch to a vertical chord diagram.

**Song library** reopens retained audio and analysis. **Lyrics** provides a larger reading view. **Settings** controls automatic lyric lookup and shows backend status. Desktop window controls appear only inside Tauri.

The startup sample is clearly marked as a demo. It is a progression preview, not analysis of an imported recording.

## Resume practice

Reopening restores the last retained song, playback position, current A–B loop, tempo, transposition, volume, instrument page, guitar preferences and lyric offset. Playback stays paused. Selecting another library song restores that song's own settings. The workspace keeps its saved layouts for each screen size.

Practice settings are saved locally in the browser or desktop profile once per second when changed, on song switches and when leaving the page. The most recent 50 songs are retained. Browser and desktop profiles save separately; this is not account synchronization or a backup. Clearing site data removes these settings but leaves backend audio, analysis and lyrics intact. A missing library song falls back to the browsing/demo workspace. Storage failures are shown in the app.

## Guitar voicings

The engine validates each candidate against the chord's pitch classes, required slash bass, fret span, and four-finger limit. Open/compact mode uses independent fingers; barre mode uses a verified index-finger barre. It ranks easier and lower-position shapes first and offers alternative voicings. Capo is explicit: fret numbers are relative to it, while the diagram and note previews sound in the original chord's key.

Unsupported combinations show an unavailable state rather than an arbitrary chord-tone map. Finger-count and fret-span checks are conservative heuristics, not a guarantee that every hand can play every suggested shape. The capo recommendation evaluates unique chords so repeating a progression cannot skew the result.

## Playback and timeline

The player uses the actual local/managed audio source through Web Audio and SoundTouch. Tempo and pitch are controlled independently. Transpose updates chord labels, tones, displayed key, instrument diagrams, and exports. Space toggles playback and arrow keys seek when focus is outside controls.

The timeline is proportional to song time. Click to seek, drag to select a loop, zoom for short chord changes, and toggle follow mode to browse independently. It shows time, not an invented beat/bar grid. Loop handling lives with the playback clock, including loops ending at the end of the track. Progressive analysis updates do not automatically resume paused playback.

Chord-sheet edits save to the backend; reset transpose to zero before editing source chords. Corrections preserve unaffected time ranges. Text chart export uses the displayed arrangement.

## Synced lyrics

When enabled, importing/opening a song first checks stored lyrics and then searches LRCLIB. Search prefers synced lyrics and matches title, artist, and duration. Song metadata goes to LRCLIB; audio is not sent there. Automatic lookup can be disabled. An explicit search form lets you correct metadata.

LRC/TXT import works locally. Timestamped lines follow playback, click to seek, support LRC offsets and a saved per-song timing adjustment shared by the workspace and Lyrics page, and scroll inside the lyrics panel. Plain lyrics remain readable when timed lyrics are unavailable. No provider guarantees coverage for every recording.

## Architecture and checks

Read [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries and runtime behavior. Tests:

```powershell
.venv\Scripts\python -m pip install -r backend\requirements-dev.txt
.venv\Scripts\python -m unittest discover -s tests -v
cd frontend
npm test
npm run build
cd src-tauri
cargo check --locked --jobs 2
```

`scripts/runtime_probe.py` generates a synthetic audio fixture and exercises local upload, analysis, timeline, and retained-audio playback. This is a pipeline smoke test, not a recognition-quality benchmark.

Desktop source compilation and development launching are separate from distributing a self-contained installer. The Python environment/model stack is currently managed separately from the Tauri binary. Packaged installer acceptance and broad musical-accuracy/listening benchmarks remain release gates.

The original PyQt application remains under `legacy_desktop`; root `run.bat` and `run.sh` still launch it. See [legacy_desktop/README.md](legacy_desktop/README.md). Project code is MIT licensed; review dependency, model, and sample-asset licenses before redistribution.
