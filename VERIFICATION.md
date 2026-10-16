# Studio rework verification

## Bundled distribution — 16 October 2026

- The frozen Windows engine completed real lv-chordia 1.1.0 inference locally with all five packaged checkpoints verified against the build manifest. The same test checked authenticated access, rejected unauthenticated requests, served a byte-range audio response and exited after its ownership pipe closed. No source Python imports are used by that executable.
- CI run [38863813690](https://github.com/chinmaykrishnroy/DeChord/actions/runs/38863813690) passed the frontend suite (27 tests), three Chromium integration tests, all four Windows/Linux Python 3.10/3.11 jobs (57 tests each), real frozen inference on both platforms, native desktop launch/shutdown on Windows and Linux, and native Docker build/inference on amd64 and arm64. The final tag pipeline repeats every gate before publication.
- Binary testing exposed Windows native-library initialization deadlocks in worker-thread imports. The packaged entry point initializes NumPy, SciPy, Torch and the required lazy librosa modules on the main thread before opening the service. The independent inference gate passed after this change. Linux AppImage deployment also required private ELF search directories and exclusion of Numba's unused optional TBB pool.
- Both Linux x86_64 packages passed actual UI launch tests on Ubuntu 24.04: the installed Debian app and the AppImage each reported `frontend_ready: true`, a healthy version-matched engine and a closed engine port after exit.
- The Windows x64 release binary copied into its portable distribution likewise reported `frontend_ready: true`, a healthy bundled 1.0.0 engine and a closed engine port after exit on Windows Server 2022. The installer was built with offline WebView2 setup; interactive installation itself was not automated.
- The smoke harness now gives both the engine and webview explicit temporary storage paths and starts outside the checkout. Windows known-folder APIs do not honor APPDATA overrides; the harness therefore checks the actual engine path, SQLite file and separate webview directory instead of assuming those overrides isolate tests.
- Each desktop includes a Python runtime, CPU models, FFmpeg and dependency/license inventories. The installed user profile owns persistent data and the Numba cache. Per-launch ports/tokens and version matching isolate the supervised engine; normal exit and platform process-group cleanup bound its lifetime. The Windows release uses the GUI subsystem and includes an offline WebView2 installer.
- This supersedes the older notes below about unavailable lv-chordia and separately managed production runtimes. Generated tones establish inference execution and data flow, not chord accuracy. Hosted native UI tests do not replace clean-machine install/update/uninstall trials, physical audio-device testing or musician validation. Binaries remain unsigned.

## Sidebar scrolling regression — 16 October 2026

- Reproduced the reported clipped-song strip at 1280x720 after scrolling: the header started 11px below the scroll container's top, and hit-testing above the header returned a song button. A live assertion failed with `REGRESSION: a song paints above the Your music header after scrolling`.
- The header now sits outside a dedicated clipped song scroller. Brand/navigation/Settings do not shrink or join that scroll area. Compact-height navigation leaves room for the list rather than collapsing it.
- Live geometry assertions passed at 1280x720, 1000x650, 1280x560 and 1280x533. The last size reserves space equivalent to the native title bar at minimum window height: 62px song viewport for 51px rows, no outer sidebar overflow. At 390x844 the icon rail hides the mini-library and the document has no horizontal overflow.
- `frontend/tests/sidebar-probe.js` retains the painted-geometry regression for a live browser/DevTools run after scrolling; the ordinary Node suite cannot evaluate CSS clipping.

## Practice recovery milestone — 16 October 2026

- Frontend suite: 27 passing tests, including session round trips, per-song isolation, 50-song retention, duplicate identities, corrupt/versioned storage and duration-clamped positions/loops. TypeScript and production build passed. The preceding checkpoint passed all 53 backend tests and offline Windows Cargo check; this milestone changes frontend code only.
- Browser actions set 85 BPM, -2 semitones, manual capo 3, lyric offset 1.25 seconds and position 69 seconds on a retained MP3. A timeline drag created a 1:10–1:14 loop. Reload restored those controls and the loop with audio paused, initially readyState 1 and subsequently 4. Switching to C-major started at zero with no loop/transpose; switching back restored the MP3's separate settings and readyState 4 without an alert.
- An initial development reload briefly displayed a playback warning; a subsequent fresh reload and the explicit reload/switch checks above did not reproduce it. Browser checks do not establish audible quality or long-session/crash durability. Persistence is profile-local; clearing site data removes practice preferences.
- The native development watcher also rebuilt the executable after the simplified icon asset update. Extracting its embedded Windows icon confirmed the bold pick/play mark at 32px.

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
- Quarter zoom selection returned 0.25 with option background rgb(33,42,36) and text rgb(238,247,240).
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
