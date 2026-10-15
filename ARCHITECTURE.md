# DeChord Studio architecture

## Boundaries

- `app/shell/AppShell` coordinates navigation, the current session, player settings, and widget rendering. It owns no fingering search or inference code.
- `features/workspace/WidgetGrid` owns drag/resize and accessible placement. `layout.ts` owns serializable layouts and breakpoint constraints. Layouts live in versioned browser storage, independently of songs.
- Guitar `model/guitar.ts` is a deterministic domain engine. Curated shapes live in `voicings.ts`; all curated and generated candidates pass the same validation. Rendering is isolated in `Fretboard` and `GuitarWidget`.
- `features/playback/usePlayback` streams through an HTML audio element and samples its media clock. Untransposed playback uses native pitch preservation; transposition routes the source through the bundled SoundTouch AudioWorklet on the audio rendering thread. React never synthesizes time for real recordings. `clock.ts` contains the tested loop-time contract. Source-less playback is reserved for the marked demo.
- `Timeline`, `ChordSheet`, `LyricsWidget`, and `PianoPage` are independent UI surfaces. They receive explicit current data and actions rather than reaching into the database.
- `services/backendClient` owns HTTP contracts and maps backend models into frontend music types. `useBackendWorkspace` owns source lifetimes, library selection, stale-result guards, streamed updates, lyric loading, and correction persistence.
- The backend divides routes, domain contracts, orchestration, persistence, media tools, inference adapters, and the lyrics provider. The lyrics provider does not depend on HTTP routing or music inference.

## Import and storage

Uploads are copied in bounded chunks with a 512 MB limit, probed and content-hashed, and retained under a stable managed filename. Duplicate imports reuse that source. Audio, SQLite metadata, raw analyses, manual corrections, and lyrics stay local. Failed imports clean temporary uploads. Extracted analysis WAV windows are transient and cleaned by the engine adapter.

Managed songs can be reopened without reupload through `/songs` and `/songs/{id}/audio`. A browser `File` object URL provides immediate playback in the current import session. Album-art object URLs are revoked on replacement/unmount.

SQLite uses WAL and a busy timeout. A force recompute preserves the previous successful job. Corrections replace saved correction data, not raw inference; interval overlays retain the original material outside each edit.

## Inference

One bounded executor lane serializes inference and deduplicates submissions of the same job. This controls memory/model contention and avoids launching the same resumed job twice. The design targets one local backend process; it is not a distributed queue. Interrupted work resumes through the existing completed-batch contract on resubmission.

The modern backend does not load Qt. It can therefore run inference directly without the legacy per-window Torch subprocess. lv-chordia's resident session API is used when present; older package versions retain the one-shot path. madmom chord/key/tempo processors are lazily cached. Alternative librosa global estimates share one decode/STFT and retain only estimates, with cache invalidation based on source path, size, and modification time.

Engine selection is resolved before job creation. Cache signatures include actual chord engine/package identity and a preprocessing version; stored segment provenance uses that identity. A runtime error in the selected engine is reported rather than silently relabeling fallback results as a different engine. Key/tempo may be unavailable independently of chords.

Full-song analysis is the default because it provides continuous model context. Progressive batches use context padding, trim to absolute song time, and persist results independently. No claim is made that shorter windows improve recognition accuracy.

## Data transport

`GET /analysis/jobs/{id}/events` is an SSE stream. It sends changed job metadata and newly completed batches, advances a completed-batch cursor, keeps the connection alive, and terminates at a terminal job state. The frontend merges batches by index. Compatibility polling is used after a stream error; a final corrected timeline is fetched once at completion.

Network work runs outside the inference lane. Upload copying/probing executes in the thread pool instead of blocking the async request handler. FFmpeg operations have timeouts. The stream checks for client disconnects. The frontend guards asynchronous results by session/version so an older song or lyric lookup cannot overwrite a later one.

## UI layout

The charcoal shell has a persistent player and independent main-content scroll area. Desktop navigation reduces to an icon rail on narrow screens. The workspace grid uses 12, 8, or 1 columns based on measured container width, not the outer window. Each breakpoint has its own saved layout. Native and keyboard movement use collision resolution. Only completed drag/resize operations are persisted, preventing an internal layout callback from overwriting a controlled move.

Widgets have explicit content bounds and container-aware instrument rendering. Layout version 2 resets the old oversized defaults, restores piano, and removes timeline from the movable widget registry. Hidden placements are merged by widget ID without duplication. Synced lyrics appear alongside instruments when available; otherwise that space is available to other panels. Lyrics use artwork colors and center the active line using viewport coordinates, including after resizing.

The practice timeline owns a compact shell row immediately above the player, with height bounded by the viewport. At the default zoom, its linear time axis has enough pixels per second for chord labels; an overview can zoom down to 0.25x. Follow mode scrolls chord content continuously beneath a fixed playhead with leading/trailing space, including the track boundaries. Turning follow off preserves the viewport and lets the playhead travel. Mouse-wheel, keyboard, and scrollbar navigation remain available. It does not pretend BPM alone provides downbeats or section boundaries.

Tempo and transpose fields commit typed values on Enter/blur, support cancellation with Escape, and reset to the source tempo/zero semitones on double-click. Displayed tempo bounds match the actual supported playback-rate bounds. The audio element is document-owned and hidden, with explicit cleanup. Development API and media routes share the frontend origin through Vite's proxy.

## Practice recovery

`practiceSession.ts` defines the versioned, bounded per-song storage contract and validates every restored number, loop, page and guitar preference. `usePracticeSession` owns settings and position references. Widgets share guitar preferences and lyric offset through one provider, so changing pages cannot reset them. Position samples do not trigger extra renders. Changed sessions are persisted at most once per second, on song activation, page hide and visibility changes; unchanged sessions do not write. A fresh storage read merges other tabs' song entries before writing. Concurrent edits of the same song use the last writer; this is local preference storage, not synchronized collaboration.

Startup waits for the library before opening the last retained song, and yields to an import or selection already made by the user. Restoration never stores or restores play intent. The player queues seeks until media metadata is available and clamps against the new source duration. Each song saves its current loop, tempo offset, pitch, volume, page, capo mode, easy-shape list and lyric offset. The 50 most recently saved songs are retained. Workspace layout remains a separate profile-wide preference with breakpoint-specific placements. Browser and desktop origins/profiles have independent storage; the backend remains the owner of audio and analysis. Named loop collections and portable session backup remain future work.

## Capo planning and native drops

`POST /guitar/plan` accepts unique exact chord labels with their accumulated durations, preferred easy shapes, open/barre mode, and an optional manual capo. The backend validates pitch coverage, slash bass, fret span, physical fret limit, and finger count before scoring each position. Candidate costs are cached, while preferences and duration weights are applied per request. Manual capo is never overridden. The frontend keeps user preferences in local storage and cancels stale requests; it no longer searches capo positions on the UI thread.

Tauri's native drop events import local song paths through the backend. Browser File objects use multipart uploads. Dropped LRC/text files in the native shell use a bounded, extension-restricted Rust command; both drop paths share the existing lyric save flow. The desktop uses the native event path because Tauri intercepts WebView2 file drops; see the [Tauri drop-event API](https://v2.tauri.app/reference/javascript/api/namespacewebview/#ondragdropevent).

The audio worklet is a build asset, with no runtime CDN dependency. Its source-rate compensation follows the [SoundTouch AudioWorklet API](https://github.com/cutterbl/SoundTouchJS/tree/master/packages/audio-worklet).

## Remaining release work

The local service deliberately has no multi-user account model. Before public hosting, add authentication, request/resource isolation, upload quotas, and a durable service queue. Before a standalone desktop installer, bundle and supervise the Python runtime/models and run clean-machine installer tests. Before accuracy claims, benchmark reference recordings and validate guitar ergonomics and audible playback with musicians on target devices.
