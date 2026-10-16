# Reliable practice beta

## Delivered: studio foundation

Compact responsive shell, anchored timeline, modular workspace, guitar/piano practice previews, server capo planning, retained library artwork, synced lyrics, media-clock playback and managed development startup. The simplified pick/play icon is shared by web and desktop assets. Checkpoint: `6e97469` on `pro-backend-foundation`.

## Delivered: practice recovery

The last retained song reopens paused. Position, current A–B loop, tempo, transposition, volume, instrument page, guitar preferences and lyric offset persist separately for up to 50 songs. Workspace layouts keep their existing profile-wide persistence. Controls agree when moving between workspace, Lyrics and instrument pages. Validation and browser reload/song-switch checks are recorded in VERIFICATION.md.

Scope: local browser/desktop profile, one current loop per song. Named section collections, per-chord preferred fingerings and portable backup are not delivered.

## Implemented: desktop and web distribution

Tauri embeds the UI and supervises a bundled Python runtime, CPU inference models and FFmpeg through a private authenticated loopback connection. Version checks, checkpoint integrity and bounded child cleanup protect startup and shutdown. The release pipeline produces Windows installer/portable and Linux Debian/AppImage packages, exercises frozen inference and native UI startup, and tests Docker images on native amd64/arm64 runners before publication. See RELEASING.md and VERIFICATION.md for evidence and limits.

Clean-machine install/update/uninstall acceptance and data-preserving upgrade trials remain outstanding. The existing BAT launcher is a development/testing entry point; release users open the packaged application.

## Next: musical trust

Build a rights-cleared reference set and measure chord labels and boundaries separately from fingering validity. Exercise audible playback, pitch, tempo, loops and device changes on real Windows hardware. Publish reproducible measurements and known limitations before making accuracy or reliability claims.

## Next: guided practice

Named loop sections, count-in, verified beat/bar guides, keyboard-accessible loop editing, a distance-reading preference and correction undo. Validate the complete import-to-resume flow with beginning guitarists and pianists before expanding into MIDI or microphone scoring.
