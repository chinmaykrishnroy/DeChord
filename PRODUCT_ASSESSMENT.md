# DeChord product direction

Assessment: 15 October 2026. These are recommendations, not completed features or a claim of production readiness.

The strongest product promise is: **turn a recording into a practice session that a beginner can actually play.** Guitar, piano, lyrics and analysis should serve that one outcome. The useful differentiation is the combination of practical fingerings, advance notice of chord changes, and a dependable practice player.

## 1. Earn trust before adding more features

Make audio continuity, chord timing and reliable startup release gates. Test actual recordings through import, analysis, playback, seeking, looping, tempo changes and transposition. Include long sessions, switching songs while processing, disconnecting a source file, and reopening after a crash. Listen on real Windows audio devices; muted browser automation cannot certify sound quality.

The stale backend/artwork failure was confirmed in the running application. This update adds source revision checks, replaces only a verified stale backend from this workspace, and cleans up launcher children. That fixes this failure mode; it does not establish a self-contained installation or an exhaustive lifecycle guarantee.

A browser media-source failure appeared in a session that was open during hot reload. Byte-range audio responses were valid. Fresh development and built-frontend sessions both played the same recording with readyState 4 and no reported playback error. That recovery is verified; the precise transient cause is not established, and it is not evidence of audible quality or crash recovery.

## 2. Measure musical accuracy and communicate uncertainty

Build a rights-cleared reference set with verified chord boundaries, covering acoustic recordings, dense mixes, vocals, bass inversions, extended chords and silence. Report results separately for roots, major/minor chords, sevenths, bass notes and timing. MIREX describes chord symbol recall and duration-weighted evaluation, which provide a useful starting point: [Audio Chord Estimation](https://music-ir.org/mirex/wiki/2026%3AAudio_Chord_Estimation).

Do not equate a successful analysis job with a correct transcription. Give users a fast correction flow with undo, and preserve corrections when analysis changes. Distinguish confirmed silence from an uncertain chord estimate where the engine provides enough evidence to do so. Keep the detected harmony available even when displaying a beginner-friendly substitute.

The current checks establish API orchestration and fingering constraints. They do not establish recognition accuracy on a representative music library.

## 3. Complete the practice loop

Saved practice recovery now covers the last song and position, the current A–B loop, tempo/transposition/volume, capo and easy-shape preferences, lyric offset and instrument page. Workspace layout persists separately. Reopening stays paused. These settings belong to the local browser/desktop profile. Named loop collections, per-chord voicing choices and portable backup remain unfinished.

Then add a count-in, beat/bar guides and repeatable sections. A gradual tempo ramp after successful repetitions would be more useful than many additional widgets. Previous/current/next diagrams are a good beginner aid; retain one emphasized current chord and a consistent capo across the sequence. At narrow sizes, prioritize the current and upcoming chords.

Validate the experience with a small group of guitarists and pianists. Watch them import a song, select an easy capo, repeat a difficult change, correct a chord and resume tomorrow. Record completion time, mistakes and where they need help. Let those observations determine the next feature.

## 4. Make readability a product setting

Offer a distance/practice display mode with larger chord names and finger numbers, less chrome and keyboard shortcuts. Preserve compact browsing as another mode. Add a text-size preference rather than repeatedly adjusting fixed values.

Check album-derived palettes against light and dark covers, keyboard focus, active notes and selected states. Do not rely on hue alone. WCAG's non-text contrast guidance gives a practical reference for meaningful component and state boundaries: [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html). This update improves key outlines and feedback; it is not a full accessibility certification.

Consolidate component styles after the interaction changes settle. Multiple layers of CSS overrides already caused a real typography override to be missed during verification.

## 5. Make installation and ownership boring

Ship a tested desktop installer with an explicitly managed backend and analysis dependencies. A launcher that relies on a local development environment is useful for testing, but is not a consumer-ready installation. Verify first run on a Windows machine without Python, Node or repository files.

Make library backup/export and recovery straightforward. Clearly disclose which operations are local and which lyric lookups send metadata to a provider. Provide visible analysis cancellation/retry and clear cache management before adding optional cloud accounts.

The icon is a bold guitar pick with a single play cutout. Two flat shapes stay readable at taskbar size; the same vector generates the web mark and desktop icon assets.

## Recommended next milestone

Call the next milestone a reliable practice beta. Complete clean-machine installation, saved-session recovery, a real-audio listening matrix and a measured chord-accuracy baseline. Recruit a small pilot group and resolve the issues that repeatedly prevent a complete practice session. Treat MIDI input, microphone scoring and cloud synchronization as later experiments after that foundation holds.
