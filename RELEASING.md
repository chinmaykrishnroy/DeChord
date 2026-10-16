# Building and verifying a release

## Desktop architecture

The React UI is embedded by Tauri. A separate bundled, relocatable engine folder contains the Python runtime, FastAPI service, CPU inference stack, model data and FFmpeg binaries. The process boundary keeps inference off the webview/UI thread while preserving one application to install and launch. Packaging uses [Tauri resources](https://v2.tauri.app/develop/resources/) and [PyInstaller's one-folder distribution](https://pyinstaller.org/en/stable/operating-mode.html), avoiding a large self-extracting Python archive on every launch.

Rust starts only the engine shipped with that installation. It allocates a loopback port, generates a per-launch token, passes secrets in the child environment, waits for authenticated/version-matched readiness, then supplies the connection through Tauri IPC before React mounts. The frontend keeps the token in memory. Fetch requests use a bearer header; media and SSE use scoped resource tokens because browser audio/EventSource cannot set those headers. Access logging is disabled for the engine. A failed startup is shown in the window rather than falling back to another Python installation or a stale process on port 8765.

The child holds a read pipe owned by the desktop. EOF requests graceful service shutdown even after an unexpected parent exit. The supervisor waits for normal exit and kills its own child only after a bounded shutdown deadline. Persistent data stays outside the application installation. Development mode retains the existing launcher workflow and API proxy; production does not use the development BAT files.

## Build commands

Use Python 3.11, Node 24, Rust stable and the documented Tauri platform build prerequisites. Create a separate build environment, install the CPU-only Torch wheel from the official PyTorch index, then install backend/requirements-desktop.txt. Run:

```
python scripts/check_version.py
python scripts/build_engine.py
python scripts/smoke_engine.py frontend/src-tauri/resources/engine/dechord-engine.exe
cd frontend
npm ci
npm run tauri:build -- --config src-tauri/tauri.release.conf.json --bundles nsis
cd ..
python scripts/smoke_desktop.py frontend/src-tauri/target/release/dechord.exe
```

On Linux, use `dechord-engine` without `.exe`. From the frontend directory, expose the private ELF dependency directories to linuxdeploy when building:

```bash
engine_libs="$(find "$PWD/src-tauri/resources/engine/_internal" -type f -name '*.so*' -printf '%h\n' | sort -u | paste -sd:)"
LD_LIBRARY_PATH="$engine_libs:${LD_LIBRARY_PATH:-}" APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri:build -- --config src-tauri/tauri.release.conf.json --bundles deb,appimage
```

Install the Debian artifact, then run the desktop smoke test against `/usr/bin/dechord` under `xvfb-run -a dbus-run-session`. Test the AppImage separately with `APPIMAGE_EXTRACT_AND_RUN=1`. A native Linux build is required; PyInstaller output is not cross-platform.

The smoke test requires a report sent by the rendered frontend after it has connected to its bundled API. It then checks that the engine port closes when the desktop exits. The independent frozen-engine smoke verifies authentication, upload/import, bundled model inference, media ranges and owner-pipe shutdown. Generated tones check execution and data flow, not recognition accuracy.

## CI and publication

The workflow runs frontend formatting/unit/build checks, browser regressions, Python checks on Windows/Linux and Python 3.10/3.11, Windows/Linux native packaging and execution, and Docker build/inference tests on native amd64/arm64 runners. Browser traces/screenshots and desktop packages are retained as artifacts.

Only a v1 tag whose version matches all manifests and whose commit is on main can publish. Publication waits for every required job, creates a multi-architecture image manifest, attaches the desktop artifacts and SHA256 checksums, and uses RELEASE_NOTES.md. A failed gate leaves the release unpublished. Source archives are provided by GitHub. Do not move an existing published version tag to repair a release.

v0.1.1 intentionally identifies the legacy main commit before the Studio merge. Preserve that historical tag.

## Web deployment

The Docker build serves the production frontend from FastAPI on the same origin, uses one bounded inference worker and runs as an unprivileged user. `/data` is the persistent library volume. compose.yaml binds only to 127.0.0.1. External hosting needs authenticated TLS ingress and operator-managed access; this release is a single-user local application, not a multi-tenant service.

The container is built and exercised natively for amd64 and arm64 before the release manifest is published. Both image archives are also round-tripped through `docker load` and attached to the release, allowing installation without registry access. A newly created GHCR package may require a one-time visibility setting in GitHub; the release archives remain available independently. Runtime dependencies are installed from the same declared requirements as desktop; each frozen engine includes its installed dependency inventory and FFmpeg license output. The [lv-chordia project](https://github.com/openmirlab/lv-chordia) documents its bundled model artifacts.
