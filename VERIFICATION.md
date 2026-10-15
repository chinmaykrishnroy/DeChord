# Studio rework verification

## Instrument pages, motion, controls and new icon

- Backend regression suite: 53 passing tests. Frontend regression suite: 23 passing tests. TypeScript and Vite production build passed.
- The actual desktop backend returned generic 404 responses for both known covers. Its process predated the artwork route. The updated launcher replaced only the verified workspace uvicorn process; the same requests then returned 200 image/jpeg, 5055 and 4397 bytes. A subsequent launcher run reused the current source revision without restarting it.
- Lyric offset background changed from rgb(34,38,35) to transparent, inheriting the album-colored surface. Zoom options now have explicit dark backgrounds and readable foregrounds.
- Piano chord tones have contrasting inset outlines; clicking a key yielded aria-pressed=true, an amber background and a 3px dark inset for 450ms.
- The workspace fretboard previously rendered a 668x145 viewBox into a 668x96 area. After reclaiming the separate voicing footer and using measured diagram dimensions, it rendered a 676x121 viewBox into a 676x125 area. Finger markers use proportional sizing and three or four relevant frets where possible.
- Guitar and Piano pages expose previous/current/next chords. Explicit N segments remain rests, gaps and track boundaries have empty states, and all guitar diagrams use one server-planned capo. Piano previews use one octave; the workspace keeps its two-octave keyboard.
- During real MP3 playback, 48 browser observations included 36 scroll changes between React timeline updates, confirming that frame drawing reads the live media clock. With Follow disabled, scrollLeft remained 10052 while the cursor advanced. Re-enabling Follow restored the anchored view.
- Responsive checks at 760x560 and 390x844 found no horizontal document overflow; the practice dock and player met without overlap. Narrow layouts prioritize current and next chord previews.
- One in-progress hot-reload session reported unsupported media. Fresh development and built-frontend sessions both played the same MP3 with readyState 4 and no reported playback error. Listening quality and the precise transient cause remain unverified.
- The icon now uses a bold pick silhouette and one play cutout, replacing the detailed D mark after small-size review. Web SVG, favicon, Windows ICO, macOS ICNS and PNG sizes derive from the same vector using the existing Tauri icon command. The 32px and 128px generated assets were visually inspected.
- The native development watcher previously rebuilt and relaunched the Windows executable with the D mark; the replacement assets are included for the next native build. Quarter zoom selection returned 0.25 with option background rgb(33,42,36) and text rgb(238,247,240).
- Product recommendations and remaining release gates are in PRODUCT_ASSESSMENT.md. Tests and muted playback do not establish recognition accuracy, audible quality or clean-machine installer readiness.

## Sidebar artwork and lyric text follow-up

- Backend suite: 51 passing tests, including thumbnail cache reuse, source-file invalidation, partial-file cleanup, image responses and missing-artwork fallback.
- Frontend suite: 21 passing tests; TypeScript and Vite production build passed.
- Real FFmpeg extraction produced 160x160 covers for the saved Selena Gomez and Memory Leak recordings. The Cymatics loop and C-major fixture have no embedded artwork and retained note icons in the browser sidebar.
- Browser review at 1280px width confirmed decoded sidebar images, 30.42px workspace lyrics in a 338px panel, and 54.6px full-page lyrics. Text wrapped without horizontal overflow. The lyric viewport now responds to width changes when centering the active line.
- Verification used separate temporary servers; the running desktop session was left intact. Relaunch the desktop app and launcher to load the new artwork API route.

Verified locally on Windows on 15 October 2026. Base branch commit: `1d8396e5e7d0638f089870657f5713bd4198f8c2`. Work is on `pro-backend-foundation`.

- Python regression suite: 47 passing tests, including API upload/library/source, incremental SSE batches, duplicate queue submission, lyric matching, partial corrections, resident inference sessions, automatic/manual capo selection, duration weighting, exact extensions/slash bass, desktop path import, and byte-range audio serving.
- Frontend regression suite: 21 passing tests covering Open/Barre integrity, exact chord tones, slash bass, familiar D fingering with capo 4, finger assignments, loop boundaries, readable timeline scale, fixed-playhead geometry and quarter zoom, typed transport input, intrinsic logo bounds, default piano visibility, hidden-layout merging, keyboard collision resolution, lyric viewport centering, LRC offsets, and placeholder lyrics.
- TypeScript and Vite production build passed.
- Tauri `cargo check --locked --offline --jobs 2` passed after dependencies were fetched. This is a source compile check, not installer or native listening acceptance.
- Dependency audit after compatible updates: zero reported vulnerabilities.
- Browser review at wide desktop and 1280×800; 390×844 narrow-screen check showed no horizontal page overflow and a vertical fretboard.
- Browser interactions verified adding/hiding widgets, persistence after reload, keyboard movement, mouse drag snapping, and resizing with saved dimensions. A real breakpoint initialization bug and an internal layout callback overwriting controlled moves were found and fixed during these checks.
- A generated 12-second sine-triad WAV was imported, analyzed through the installed madmom engine, and served again from the retained library. Key result was C major; the chord model returned N for this artificial signal. This verifies orchestration/source durability, not chord accuracy.
- A live LRCLIB query using public song metadata returned synced lyrics. Provider matching and synced-result preference also have deterministic tests.
- Browser integration reopened the managed fixture, saved a manual N-to-C chord correction, displayed the C fingering on seeking to the start, and advanced real-file playback to its 12-second end with volume muted.

## Follow-up polish checks

- The original D-shape regression failed with actual frets `[x,10,11,0,x,x]` for F-sharp/capo 4. It now returns the familiar `[2,3,2,0,x,x]`, classified as independent fingers.
- Live capo API selected capo 6 for F-sharp, G-sharp, C-sharp, D-sharp minor with preferred shapes C, D, G, A minor. The API suite checks manual override and duration-weighted changes.
- Planner timing on a four-chord fixture: 127.2 ms cold, 0.839 ms mean with candidate costs cached (100 requests in-process). This is a local measurement, not an inference benchmark.
- Browser reopened a real saved recording with cached analysis, synced lyrics and artwork. Seeking to 90 seconds centered the active lyric with zero measured center error; artwork produced a non-default lyric palette. Every timeline block measured at least approximately 64 px (subpixel rounding: 63.98 px minimum).
- At 1280x820 and 390x844 the practice dock and player remained within the viewport, touching without overlap; the document had no horizontal overflow.
- Real-file playback and a semitone change ran without a reported processor error, with test volume muted. This verifies operation, not audible quality. The default audio path no longer uses a ScriptProcessorNode or a synthetic clock.
- The native titlebar artifact was traced to a 913x913 SVG image whose old CSS sized only inline SVG elements. Its intrinsic-bounds regression failed before adding explicit image dimensions and matching image CSS. The UI and Windows ICO files now match the main-branch `icon` file byte-for-byte; PNG and ICNS resources derive from it.
- Browser controls accepted 85 BPM and -3 semitones; double-click reset them to 100 BPM and 0 semitones. Quarter zoom was selected successfully. With follow enabled the playhead stayed at x=217 while the scroll position changed; disabling follow retained scroll position 1800 while the cursor moved to x=817 on seeking.
- Both lyric views reported the same artwork background (`rgb(190 179 44)`) and contrasting dark foreground (`#11130f`) using the branch's original palette utility. Large seeks and initial lyric navigation now center immediately, with smooth movement reserved for nearby lyric changes.
- A browser media failure with detached audio was reproduced during the follow test. The player now owns a hidden audio element in the document and removes it during cleanup. Retesting the same saved recording yielded readyState 4, position 81.5 seconds, a fixed cursor at x=217, scrolling chord content, and no playback error. Development audio/API traffic uses a same-origin Vite proxy; direct and proxied audio both returned HTTP 206 for byte-range requests.
- Continued real playback advanced to 193 seconds with scroll position 15412 while the playhead remained at x=217, with no reported playback errors. Navigating immediately to the full Lyrics section showed the active line centered with zero measured error.
- Responsive checks cover 760x560, 1920x1080 and 390x844. A stronger dock-boundary check then exposed an inherited 140 px minimum on the timeline: chord bottom 790.81 exceeded dock bottom 756. After removing the minimum, chord bottom was 739, height 30.19, fully inside the compact dock. Checking only the expanded inner scroll viewport would have missed this clipping.
- A Windows desktop executable was built with `npm run tauri:build -- --debug --no-bundle`; this is a compiled local application, not an installer or a clean-machine acceptance test.

The API test client needs loopback/socket permission on Windows. A sandbox run hung creating an asyncio socket pair; the same tests passed outside that restriction. The local runtime reuses the preexisting compatible madmom environment through an ignored `.venv` path file. This is not evidence of clean-machine engine installation.

Remaining acceptance limits: no broad recognition accuracy benchmark, no physical musician fingering study, no audible pitch/tempo/loop quality certification, and no self-contained desktop installer test. Recent lv-chordia resident sessions are covered with an adapter-level fake; lv-chordia itself was not installed on this machine during these checks. The actual runtime smoke used madmom.
