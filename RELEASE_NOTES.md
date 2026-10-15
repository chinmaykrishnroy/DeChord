# DeChord v1.0.0

The new practice studio brings guitar, piano, synced lyrics and a continuous chord timeline into one desktop and web interface.

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

The pipeline tests the frozen engine with actual inference and launches the desktop UI on Windows and Linux before publishing. SHA256SUMS.txt records the installer/package hashes. Binaries are unsigned; platform signing is not part of this release.

## Web

The shared frontend/API is distributed as `ghcr.io/chinmaykrishnroy/dechord:1.0.0`, for Linux amd64 and arm64. The included compose.yaml binds to localhost and preserves library data in a named volume. Run `docker compose up -d`, then open http://127.0.0.1:8765. Put authenticated TLS access in front of the service before exposing it beyond a trusted local machine; the application has no multi-user account model.

## Verification limits

Automated checks cover regressions, startup, shutdown, real inference execution, API/media transport and browser interactions. They do not certify audible quality on every device or chord-recognition accuracy. Lyrics depend on provider coverage. Practice preferences are local to each browser/desktop profile. Named loop collections, per-chord preferred voicings, portable practice backup, MIDI input and microphone scoring remain future work.

The earlier Python/Qt application remains available at v0.1.1.
