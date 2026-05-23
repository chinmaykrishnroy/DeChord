# DeChord Roadmap

This roadmap turns DeChord from a basic chord/key/tempo detector into a more complete offline practice and song-learning tool.

## Product Direction

DeChord should focus on being an offline, privacy-friendly desktop tool for musicians who want to learn songs from local audio files. The strongest niche is not "another cloud chord detector"; it is "open a song, understand it, correct it, transpose it, loop it, and export it without uploading the file anywhere."

## Phase 1: Stability And Trust

- Fix loading-state bugs across dark and light themes.
- Fix seek and chord-timeline time unit handling.
- Prevent older analysis threads from updating the UI after a new file is loaded.
- Add real error states for chord, key, and tempo analysis failures.
- Improve cache invalidation so changed audio files do not reuse stale analysis.
- Add a `.gitignore` and stop tracking generated Python cache files.
- Add tests for chord-label normalization and timeline behavior.

## Phase 2: Chord Vocabulary Foundation

- Add a first-class internal chord model with root, quality, extensions, alterations, bass note, display label, and source label. Done.
- Normalize labels from different engines into one consistent display system. Done.
- Support richer chord labels in the UI and exports. Done for parsing, display, chord notes, and enhanced export metadata:
  - major, minor
  - dominant 7, major 7, minor 7
  - diminished, half-diminished, augmented
  - suspended chords
  - sixths, ninths, elevenths, thirteenths
  - altered chords such as b5, #5, b9, #9
  - slash chords
- Add simple/intermediate/advanced display modes.

## Phase 3: Recognition Engine Abstraction

- Wrap the current `madmom` integration behind an engine interface. Done.
- Make `lv-chordia` the native/default chord engine for large-vocabulary PyTorch chord recognition. Done.
- Keep `madmom` as the fast/basic fallback engine. Done.
- Run `lv-chordia` in an isolated worker process so PyQt and Torch do not fight over native Windows DLL loading. Done.
- Keep optional comparison engines on the research backlog:
  - Chordino/NNLS Chroma as a possible lightweight comparison engine.
  - BTC or another transformer-based model as a possible future comparison engine.
- Store engine name, engine version, confidence, and analysis parameters in cache metadata.
- Add a comparison script for evaluating engines on a folder of test songs.

## Phase 4: Editing And Correction

- Let users click a chord segment and edit the chord.
- Add split, merge, delete, and insert segment controls.
- Save corrected chord timelines separately from raw model output.
- Export corrected timelines to text, CSV, JSON, and ChordPro.
- Preserve manual corrections when re-opening the same song.

## Phase 5: Practice Features

- Add transpose and capo mode.
- Add guitar, piano, and ukulele chord diagrams.
- Show chord notes for the selected/current chord.
- Add section loops.
- Add slow-down/speed-up playback.
- Add pitch shifting.
- Add beat and bar grid alignment.
- Add a chord sheet view alongside the current real-time view.

## Phase 6: Packaging And Release Quality

- Build a Windows installer and portable build.
- Add application versioning and a release checklist.
- Add crash logs and user-friendly diagnostics.
- Add dependency health checks.
- Review all audio-analysis dependency licenses before any commercial release.
- Add CI for linting, tests, and packaging smoke checks.

## Phase 7: Advanced AI

- Add confidence-aware chord smoothing.
- Use key and beat information to improve chord correction.
- Explore stem-assisted chord detection.
- Consider an optional cloud engine only if privacy and cost are handled clearly.
- Build an evaluation dataset from opt-in corrected timelines.
