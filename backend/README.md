# DeChord Backend

The backend is the local audio-analysis engine for DeChord. It is intentionally narrow: it imports audio, identifies songs by content hash, runs chord/key/tempo analysis, stores cached results in SQLite, and exposes analysis jobs/timelines through HTTP.

It does not own guitar, piano, capo, fretboard, voicing, or instrument UI logic. Those are frontend/product layers. The backend returns clean musical media data that any frontend can use.

## Structure

```text
backend/
  app/                 FastAPI app and routes
  core/                config, SQLite setup, media probing/extraction
  domain/              dataclass contracts shared by routes/services/repos
  engines/             chord, key, and tempo engine adapters
  repositories/        SQLite persistence
  services/            orchestration: import, jobs, batches, corrections, export
```

## API Routes

For a complete schema-level route reference, read [API.md](API.md). A Postman import file is available at [DeChord_Backend.postman_collection.json](DeChord_Backend.postman_collection.json).

### `GET /health`

Returns service status.

### `POST /songs/import`

Registers an audio file and stores a content-hash song identity.

```json
{ "path": "C:\\Users\\apurv\\Downloads\\Die With A Smile.mp3" }
```

Response includes:

```json
{
  "id": "contenthashprefix",
  "path": "...",
  "title": "Die With A Smile",
  "content_hash": "...",
  "duration": 251.2,
  "created_at": "..."
}
```

### `POST /songs/upload`

Uploads an audio file from a browser tester or future frontend and imports the stored copy.

Form data:

```text
file=<audio file>
```

Plain browser file inputs cannot expose the real local path, so upload is the correct route for select/drag-drop testing. The original path-import route still exists for trusted local app shells that can pass a filesystem path.

### `POST /analysis/jobs`

Creates an analysis job. The HTTP route returns a queued job quickly, then runs the local engine as a background task so the UI can poll job/batch state.

```json
{
  "song_id": "contenthashprefix",
  "mode": "batched",
  "batch_seconds": 30,
  "force": false
}
```

Modes:

- `full_song`: analyze the whole file in one pass.
- `preview`: analyze only the first `preview_seconds`.
- `batched`: split the song into `batch_seconds` windows and store each batch separately.
- `practice`: corrected playback/export mode. It uses the analysis timeline plus saved corrections so the UI can distinguish raw engine output from the version a musician practices.

The service reuses a completed cached job when the song hash, mode, engine, dictionary, and timing parameters match. Use `force: true` to recompute.

Chord batches are written before global key/tempo estimation finishes, so a UI can render early chord recommendations while the job is still running.

`full_song` is the default mode. If `batched` mode is requested with a batch size greater than or equal to the song duration, the backend falls back to `full_song`.

### `GET /analysis/jobs/{job_id}`

Returns job status, progress, selected engine, estimated key, estimated tempo, and errors.

### `GET /analysis/jobs/{job_id}/batches`

Returns batch results. Every chord segment uses absolute song time, even when it came from a 30-second piece. This is the important UI contract.

```json
{
  "job_id": "...",
  "batches": [
    {
      "batch_index": 0,
      "start": 0,
      "end": 30,
      "status": "completed",
      "segments": [
        {
          "start": 0.0,
          "end": 2.4,
          "label": "CM7",
          "root": "C",
          "quality": "Major seventh",
          "notes": ["C", "E", "G", "B"],
          "intervals": [0, 4, 7, 11],
          "source": "lv-chordia"
        }
      ]
    }
  ]
}
```

### `GET /analysis/jobs/{job_id}/timeline`

Returns the exact timeline for one analysis job. Use this when the UI is following a preview or batched job and should not automatically switch to a different completed job.

### `GET /songs/{song_id}/timeline`

Returns the best completed timeline for a song, with saved corrections applied over raw engine segments.

### `POST /songs/{song_id}/corrections`

Replaces saved chord corrections for a song.

```json
{
  "corrections": [
    { "start": 12.0, "end": 16.0, "label": "G:7" }
  ]
}
```

### `GET /songs/{song_id}/exports/chords`

Returns chord export rows with start/end/chord/root/quality/notes/source fields. Frontend can convert this to CSV, JSON, ChordPro, PDF, or clipboard formats.

### `GET /songs/{song_id}/lyrics`

Returns cached lyrics for the song, or `null` when none are saved.

### `POST /songs/{song_id}/lyrics`

Saves manually imported lyrics for the song.

```json
{
  "lyrics_text": "[00:12.00]First lyric line",
  "synced": true,
  "source": "manual",
  "provider": null
}
```

### `POST /songs/{song_id}/lyrics/download`

Searches LRCLIB for the current song and saves the result in SQLite.

```json
{
  "title": "Song title",
  "artist": "Artist",
  "duration": 213.5
}
```

## Caching

The backend uses SQLite at:

```text
cache/backend/dechord_backend.sqlite3
```

Song identity is based on audio content hash, not only file path. Replacing a file at the same path produces a different song hash, so stale analysis is avoided. SQLite stores songs, jobs, batches, chord segments, user corrections, and saved lyrics.

Lyrics are cached by song id. The frontend can save manually imported `.lrc`/`.txt` lyrics or ask the backend to fetch lyrics from LRCLIB. Saved lyrics are reused for that song hash, so the app does not redownload them on every open. Lookup normalizes titles such as `Artist - Song Title`, removes common media suffixes, and retries without duration to avoid brittle "not found" responses from filename-style song titles.

Browser-uploaded media is temporary. The backend deletes the copied upload file after analysis succeeds, or immediately when a matching cached analysis is reused. Cached chord/key/tempo/timeline data remains in SQLite, so playback and exports can use the database without recalculating unless `force: true` is requested.

Batched jobs are resumable. If a compatible batched job was interrupted, a new request can skip already completed batches and append missing batches to the same job record. Use `force: true` when you want a fresh replacement analysis.

## Batch Analysis Contract

For `batched` mode, the frontend chooses `batch_seconds`. The backend clamps values to a safe range from config.

The backend returns each batch as:

```json
{
  "batch_index": 2,
  "start": 60.0,
  "end": 90.0,
  "segments": []
}
```

All segment times are absolute against the original song. That makes the UI parser simple:

1. Sort batches by `batch_index`.
2. Merge `segments` by `(start, end)`.
3. Render immediately when the first batch arrives.
4. Replace with full-song analysis later if needed.

This is better than returning relative chunk times because it avoids frontend offset bugs and makes partial updates deterministic.

Each batch also returns `started_at`, `completed_at`, and `elapsed_seconds`, so the frontend can compare how quickly different batch sizes produce useful chords. Batched analysis uses a small context padding window around each piece, trims padding out of the response, and suppresses very short boundary `N` segments when they are likely chunk warm-up artifacts.

## Running Locally

Install backend dependencies in the same environment as the existing app:

```powershell
pip install -r backend/requirements-backend.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8765
```

Or run:

```powershell
.\run_backend.bat
```

Then open:

```text
http://127.0.0.1:8765/
```

The backend still uses the current audio engines:

- Chords: `lv-chordia` by default.
- Key/tempo: existing madmom-backed helpers for now.

Those can be replaced behind the adapter interfaces without changing frontend contracts.

## Future Support

Planned backend extensions:

- Background job queue and cancellation.
- SSE/WebSocket progress stream.
- Dedicated beat/bar grid engine.
- Engine capability endpoint.
- Accuracy benchmark runner.
- Engine replacement for commercial-safer key/tempo/beat analysis.
- Realtime endpoint as a separate low-latency path.

Frontend-owned features:

- Guitar/piano/ukulele rendering.
- Capo suggestions.
- Instrument voicings.
- Fretboard/keyboard note layout.
- Practice UI, loop markers, visual editing, and exports presentation.
