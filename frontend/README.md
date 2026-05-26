# DeChord Frontend

This folder contains the modern desktop frontend for DeChord. It is a Tauri + React + TypeScript app designed as an offline/private music practice workstation.

The frontend now has two operating states:

- **Preview state:** uses local sample data when the backend is not connected or no audio has been imported yet.
- **Backend state:** uploads audio to the local Python analysis engine, starts an analysis job, polls job/batch status, and renders returned chord/key/tempo data.

## Stack

- **Desktop shell:** Tauri 2
- **UI:** React 19 + TypeScript
- **Build:** Vite
- **Graphics:** SVG/CSS for guitar fretboard and piano keyboard
- **Icons:** `lucide-react`
- **Backend transport:** local HTTP API at `http://127.0.0.1:8765`

## Run

Start the backend first from the repo root:

```powershell
.\run_backend.bat
```

Then run the frontend:

```powershell
cd frontend
npm install
npm run tauri:dev
```

Browser-only development also works:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal.

## Scripts

- `npm run dev`: start the Vite dev server.
- `npm run typecheck`: run TypeScript validation.
- `npm run build`: typecheck and build the frontend.
- `npm run preview`: preview the production frontend build.
- `npm run tauri:dev`: launch the desktop shell.
- `npm run tauri:build`: create a desktop bundle.

## Environment

The frontend uses this default backend URL:

```text
http://127.0.0.1:8765
```

Override it with:

```powershell
$env:VITE_DECHORD_BACKEND_URL="http://127.0.0.1:8765"
npm run dev
```

## Structure

```txt
src/
  app/
    layout/            Shared page-level UI blocks
    shell/             Tauri title bar, side rail, app frame
  data/                Preview workspace data
  features/
    chords/            Chord queue and current chord components
    guitar/            Fretboard UI and guitar/capo model
    piano/             Keyboard UI and piano note model
    playback/          Transport and local playback timing state
    timeline/          Scroll-reading timeline, beat/bar markers, loop selection, song map
    workspace/         Main screen composition and backend workspace hook
  services/            Backend API client and response adapters
  styles/              Global CSS and theme tokens
  types/               Shared music/product contracts
  utils/               Chord and time helpers
  assets/              SVG app icon and future visual assets
```

## Backend Wiring

The frontend talks to these backend routes:

- `GET /health`
- `POST /songs/upload`
- `POST /analysis/jobs`
- `GET /analysis/jobs/{job_id}`
- `GET /analysis/jobs/{job_id}/batches`
- `GET /analysis/jobs/{job_id}/timeline`
- `GET /songs/{song_id}/lyrics`
- `POST /songs/{song_id}/lyrics`
- `POST /songs/{song_id}/lyrics/download`

The UI flow is:

1. Check backend health.
2. Let the user import or drag-drop an audio file.
3. Upload the file with `POST /songs/upload`.
4. Start an analysis job using the selected mode.
5. Poll the job and batch routes.
6. Render partial chord batches as soon as they arrive.
7. Replace partial data with the final job timeline when the job completes.

The selected audio file is also kept as a local object URL for playback. The backend does not stream audio back to the frontend; it only analyzes the upload and returns musical timeline data.

The backend returns media analysis only. Guitar voicings, piano rendering, capo scoring, theme behavior, and compact layout decisions stay in the frontend.

## Responsive UX Rules

- The app must never create horizontal page scroll.
- Compact windows hide lower-priority panels instead of compressing everything.
- The current song, current instrument, and transport remain the core small-window surface.
- Chord queue and timeline are helpful on desktop, but they can collapse or disappear on cramped windows.
- Sidebar panels avoid their own scrollbars where possible; long lyric text scrolls inside the lyric viewer only.
- The timeline has a reserved row and must not overlap the guitar or piano surface.
- Bar labels and section labels use separate visual lanes to avoid collisions.

## Instrument Views

### Guitar

- Supports open-shape mode and barre mode.
- Open-string markers render left of the nut.
- The fretboard renders at least ten frets for the current chord view.
- Clickable chord markers preview notes through real classical-guitar samples when instrument sounds are enabled.
- Capo suggestion scans the full chord list in two modes:
  - `Reasonable` rejects capo positions that make any chord unsupported when a fully playable capo exists, then strongly penalizes high capo positions.
  - `Very easy` still avoids unsupported chords, but puts more weight on maximum easy-shape count.
- The capo scorer evaluates open and barre candidates per chord, tracks hardest/unsupported chords, and exposes difficulty per chord/fret.
- Guitar logic lives under `features/guitar/` so future string audio, voicing selection, and capo preview can grow there.

### Piano

- Renders a responsive keyboard with highlighted chord tones.
- Root, third, fifth, seventh, and extension roles use distinct colors.
- Keys are clickable and play through real piano samples when instrument sounds are enabled.
- Piano logic lives under `features/piano/` for future playback and voicing work.

## Sample Playback

- Sample assets live under `public/samples/piano/` and `public/samples/guitar/`.
- Files are named with a URL-safe note format: `piano-c4.wav`, `piano-fs4.wav`, `guitar-as3.flac`.
- `s` means sharp, so `fs4` means `F#4`.
- The sampler chooses the nearest available recording and pitch-shifts it to the requested note.
- During playback, the active chord is played with the selected instrument tab. Old chord notes release quickly when the next chord starts.

## Practice Controls

- The practice timeline keeps the playback point anchored around 20% from the left, so the song scrolls past the player like a reading lane.
- Playback position updates on a 50ms UI clock so the anchored timeline scrolls smoothly instead of stepping chord-by-chord.
- Chord blocks keep enough width for full labels before falling back to truncation.
- Beat markers and bar labels are rendered from the detected tempo when available.
- Repeated progressions are detected from the chord sequence and surfaced above the lane.
- Click a chord block to seek to that chord.
- Drag across chord blocks to create a loop range; click the loop chip to clear it.
- The compact song map is only for navigation context, not for reading chord names.
- The left rail switches full work modes instead of only changing a small side widget:
  - `Studio`: guitar/piano instrument workspace.
  - `Lyrics`: large lyrics workspace.
  - `Analysis`: job mode, progress, batches, export.
  - `Practice`: loop/export/capo practice tools.
- Tempo controls appear in the transport as `<` and `>` buttons.
- Tempo controls remain disabled until the backend returns an engine tempo.
- Tempo changes use the detected engine tempo as the base and adjust audio tempo through the Web Audio playback layer.
- Semitone transpose changes the visible chord labels, chord tones, guitar view, piano view, timeline, and live audio pitch.
- Track volume is available in the transport so the analyzed song can be lowered while testing guitar/piano note previews.
- The current chord card includes a remaining-time meter that starts full for each chord and drains into the next transition.
- Major-extension labels use `M` instead of `maj`, for example `BbM7`.

## Lyrics

- Drop an `.lrc` or `.txt` file anywhere in the app to attach lyrics to the current song.
- The lyrics panel can also import a local lyric file or ask the backend to search LRCLIB for the current song.
- Imported/downloaded lyrics are saved through the backend lyrics routes and reused for the same song hash.
- Synced LRC timestamps are parsed in the frontend; LRC metadata tags such as `[ar:]`, `[ti:]`, and `[al:]` are ignored.
- The Lyrics workspace uses a Spotify-style large type view. Synced LRC lines auto-scroll with playback, manual scrolling pauses sync briefly, then the view returns to the active line.
- Album art is extracted from embedded MP3 ID3 artwork when available and displayed in the Now Playing card. The Lyrics workspace samples that artwork to set its background, foreground, accent, and muted text colors.

## Theme

The UI uses the DeChord icon in the title bar and Tauri bundle metadata. The SVG source is `src/assets/dechord-icon.svg`, and the desktop bundle uses `src-tauri/icons/icon.ico`.

The UI supports dark/light mode, a live hue slider, and an instrument-sound toggle for sampled note/chord playback. The hue updates CSS variables in real time:

```css
--hue-color
--first-color
--second-color
```

Secondary role colors stay distinct so the interface does not become a one-color wash.

## Current Limits

- Playback uses the selected local file through a browser/Tauri Web Audio player. Backend-side audio streaming is not implemented.
- Pitch/tempo shifting currently uses `soundtouchjs` for the frontend prototype; its LGPL-2.1 license needs review before a commercial release.
- The frontend polls HTTP routes; SSE/WebSocket progress can replace polling later.
- Tauri sidecar startup for the backend is not bundled yet. For now, start the backend separately with `run_backend.bat`.
- Mobile layouts are not targeted yet; the design is desktop-first with compact desktop support.

## Verification

Use these checks before handing off UI changes:

```powershell
npm run typecheck
npm run build
```

Then inspect these cases:

- Dark theme at normal desktop size.
- Light theme at normal desktop size.
- Narrow/short window with no horizontal scrollbar.
- Guitar tab in open and barre modes.
- Piano tab with visible highlighted keys.
- Backend offline preview state.
- Backend upload/analyzing/ready states.
