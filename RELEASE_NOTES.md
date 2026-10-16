# DeChord v1.0.1

This patch corrects Windows installer branding and first-launch behavior on busy or lower-memory computers.

- Keep the desktop window responsive while its local engine initializes, with a visible startup message and elapsed time.
- Allow up to three minutes for cold native initialization instead of aborting after 45 seconds.
- Stop an owned engine even when the desktop closes during its native imports.
- Embed the DeChord icon in the Windows installer and uninstaller, and remove installer preference registry keys on uninstall.
- Verify compiled icon resources and the installed application's startup/uninstall flow on the Windows CI runner.

The release also includes the practice studio:

- Compact responsive workspace with movable/resizable widgets and saved layouts.
- Open/compact and barre guitar shapes, server-side automatic capo planning and personal easy-shape preferences.
- Guitar and piano views showing the previous, current and upcoming chord.
- Anchored practice timeline, readable chord labels, smooth follow scrolling, quarter zoom and A–B loops.
- Independent tempo/transposition controls and a real audio playback clock.
- Retained local library, cover thumbnails, editable chord charts and artwork-colored synced lyrics.
- Per-song practice recovery with paused startup, saved position, loop, capo, tempo, pitch and lyric offset.
- Simplified pick/play app icon and the corrected sidebar song clipping.

## Desktop

Windows x64 installer/portable ZIP and Linux x86_64 AppImage/Debian packages include the frontend, private local API engine, CPU inference models and FFmpeg tools. Linux desktop builds target Ubuntu 24.04 or a compatible newer environment. Python and Node.js are not required on the user's machine. The desktop starts a version-matched engine on a private loopback port, authenticates its requests and stops the engine when the app exits. Audio, analysis and lyrics are kept in the user's application data directory.

The Windows installer includes offline WebView2 setup. The portable ZIP uses the system WebView2 runtime; choose the installer if that runtime is absent.

On Ubuntu 24.04 or a compatible Debian-based system, install the `.deb` with `sudo apt install ./DeChord_1.0.1_amd64.deb` so system UI dependencies are resolved. The AppImage can also run without a FUSE mount, using the same path exercised in CI:

```sh
chmod +x DeChord_1.0.1_amd64.AppImage
APPIMAGE_EXTRACT_AND_RUN=1 ./DeChord_1.0.1_amd64.AppImage
```

The pipeline tests the frozen engine with actual inference and launches the desktop UI on Windows and Linux before publishing. SHA256SUMS.txt records the installer/package hashes. Binaries are unsigned; platform signing is not part of this release.

## Web

The shared frontend/API is distributed as `ghcr.io/chinmaykrishnroy/dechord:1.0.1`, for Linux amd64 and arm64. Matching image archives and compose.yaml are attached to this release. To load an archive without registry access, download the archive for your machine's architecture and compose.yaml into one directory, then run:

```sh
docker load -i DeChord_1.0.1_linux_amd64_docker.tar.gz
docker compose up -d --pull never
```

Use the `arm64` archive on ARM machines. Open http://127.0.0.1:8765. The compose file binds to localhost and preserves library data in a named volume. Registry users can run `docker compose up -d` directly after authenticating if the package requires it. Put authenticated TLS access in front of the service before exposing it beyond a trusted local machine; the application has no multi-user account model.

## Verification limits

Automated checks cover regressions, startup, shutdown, real inference execution, API/media transport and browser interactions. They do not certify audible quality on every device or chord-recognition accuracy. Lyrics depend on provider coverage. Practice preferences are local to each browser/desktop profile. Named loop collections, per-chord preferred voicings, portable practice backup, MIDI input and microphone scoring remain future work.

The earlier Python/Qt application remains available at v0.1.1.
