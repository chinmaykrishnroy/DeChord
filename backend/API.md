# DeChord Backend API Reference

Base URL for local development:

```text
http://127.0.0.1:8765
```

The backend is a local audio-analysis engine. It stores analysis data in SQLite and identifies songs by SHA-256 content hash. Song IDs are the first 16 hex characters of the stored hash; the full hash remains available as `content_hash`.

Uploaded browser files are temporary. After analysis completes, or when a cached analysis is reused, the uploaded media copy is deleted from `cache/backend/uploads`. The chord/key/tempo/timeline data remains in SQLite and can be fetched without recalculating.

## Shared Schemas

### Song

```json
{
  "id": "54bf83df33601875",
  "path": "C:\\Users\\apurv\\Downloads\\Die With A Smile.mp3",
  "title": "Die With A Smile",
  "content_hash": "54bf83df336018752b3a49460e09c59c698b6d53bce4da1451921ee539c78af1",
  "duration": 251.667604,
  "created_at": "2026-05-24T00:26:50.968298+00:00"
}
```

Fields:

- `id`: short stable song ID derived from SHA-256 content hash.
- `path`: current local path known to the backend. Uploaded temp paths may be deleted after analysis.
- `title`: display title.
- `content_hash`: full SHA-256-based content hash.
- `duration`: seconds, or `null` if probing failed.
- `created_at`: UTC timestamp.

### Analysis Job

```json
{
  "id": "9f4d0b6ef5fa4ad7a1a9cf2c7a22fd3c",
  "song_id": "54bf83df33601875",
  "mode": "batched",
  "status": "running",
  "progress": 0.42,
  "engine": "lv-chordia",
  "dictionary": "submission",
  "key_label": null,
  "tempo_bpm": null,
  "batch_seconds": 30,
  "preview_seconds": null,
  "force": false,
  "error": null,
  "created_at": "2026-05-24T00:26:50.968298+00:00",
  "updated_at": "2026-05-24T00:27:04.968298+00:00"
}
```

Statuses:

- `queued`: accepted, not started yet.
- `running`: engine is working.
- `completed`: analysis finished and cached.
- `failed`: analysis failed; see `error`.
- `cancelled`: reserved for future cancellation support.

Modes:

- `full_song`: one full-file chord pass.
- `preview`: first `preview_seconds` only.
- `batched`: split into `batch_seconds` windows.
- `practice`: corrected playback/export timeline mode. Today it uses the same analysis path as full-song, then applies saved corrections. It exists so the future UI can separate raw engine analysis from "practice this corrected version."

### Chord Segment

```json
{
  "start": 0.6,
  "end": 5.2,
  "label": "A",
  "root": "A",
  "quality": "Major",
  "notes": ["A", "C#", "E"],
  "intervals": [0, 4, 7],
  "bass": null,
  "confidence": null,
  "corrected": false,
  "source": "lv-chordia"
}
```

All chord times are absolute seconds from the original song start, including batched analysis.

### Analysis Batch

```json
{
  "job_id": "9f4d0b6ef5fa4ad7a1a9cf2c7a22fd3c",
  "batch_index": 0,
  "start": 0,
  "end": 30,
  "status": "completed",
  "progress": 1,
  "engine": "lv-chordia",
  "error": null,
  "started_at": "2026-05-24T00:27:00.000000+00:00",
  "completed_at": "2026-05-24T00:27:16.300000+00:00",
  "elapsed_seconds": 16.3,
  "created_at": "...",
  "updated_at": "...",
  "segments": []
}
```

Batch timing fields:

- `started_at`: UTC timestamp when this batch/full-song pass began.
- `completed_at`: UTC timestamp when this batch/full-song pass completed.
- `elapsed_seconds`: wall-clock analysis time for the batch/full-song pass.

## Routes

## `GET /health`

Checks whether the backend is alive.

Request body: none.

Success response:

```json
{ "status": "ok" }
```

Common use:

- App startup health check.
- Postman smoke test.

## `POST /songs/import`

Imports a trusted local filesystem path. Use this from desktop shells that can access real paths. Browser file inputs should use `/songs/upload`.

Request headers:

```text
Content-Type: application/json
```

Request body:

```json
{
  "path": "C:\\Users\\apurv\\Downloads\\Die With A Smile.mp3"
}
```

Success response: `Song`.

Errors:

- `404`: file path does not exist.
- `500`: media probing failed, usually FFmpeg/ffprobe unavailable.

Notes:

- This route does not copy or delete the original file.
- The file must remain available if you later force recompute.

## `POST /songs/upload`

Uploads an audio file from a browser and imports it.

Request type:

```text
multipart/form-data
```

Form fields:

- `file`: required audio file.

Success response: `Song`.

Errors:

- `400`: missing `file` field.
- `500`: upload parsing or media probing failure.

Cache behavior:

- Uploaded media is copied to `cache/backend/uploads`.
- After successful analysis, or cached analysis reuse, that copied media file is deleted.
- Analysis rows remain in SQLite.

## `POST /analysis/jobs`

Creates an analysis job. The HTTP route returns quickly; actual analysis runs in a background task. Poll `/analysis/jobs/{job_id}` and `/analysis/jobs/{job_id}/batches`.

Request headers:

```text
Content-Type: application/json
```

Preview request:

```json
{
  "song_id": "54bf83df33601875",
  "mode": "preview",
  "preview_seconds": 30,
  "force": false
}
```

Batched request:

```json
{
  "song_id": "54bf83df33601875",
  "mode": "batched",
  "batch_seconds": 30,
  "force": false
}
```

Full-song request:

```json
{
  "song_id": "54bf83df33601875",
  "mode": "full_song",
  "force": false
}
```

Success response: `Analysis Job`.

Errors:

- `400`: unsupported mode or invalid parameters.
- `404`: song ID does not exist.

Cache behavior:

- If `force` is `false`, the backend reuses a completed job when song hash, mode, engine, dictionary, and timing params match.
- If `force` is `true`, the backend recomputes and needs the audio file path to exist.
- For browser uploads, recompute after cleanup requires uploading the file again.
- If `mode` is `batched` and `batch_seconds` is greater than or equal to the song duration, the backend automatically falls back to `full_song`.
- If a previous compatible batched job stopped mid-analysis, the backend can resume it by skipping completed batches and appending missing batches.

## `GET /analysis/jobs/{job_id}`

Gets one job status.

Path params:

- `job_id`: analysis job ID.

Success response: `Analysis Job`.

Errors:

- `404`: job not found.

Frontend use:

- Poll this route every 1-2 seconds while job is `queued` or `running`.
- Use `progress` for progress bars.
- `key_label` and `tempo_bpm` may be `null` until the job completes.

## `GET /analysis/jobs/{job_id}/batches`

Gets all batches for one job, including chord segments per batch.

Path params:

- `job_id`: analysis job ID.

Success response:

```json
{
  "job_id": "9f4d0b6ef5fa4ad7a1a9cf2c7a22fd3c",
  "batches": [
    {
      "job_id": "9f4d0b6ef5fa4ad7a1a9cf2c7a22fd3c",
      "batch_index": 0,
      "start": 0,
      "end": 30,
      "status": "completed",
      "progress": 1,
      "engine": "lv-chordia",
      "error": null,
      "started_at": "2026-05-24T00:27:00.000000+00:00",
      "completed_at": "2026-05-24T00:27:16.300000+00:00",
      "elapsed_seconds": 16.3,
      "created_at": "...",
      "updated_at": "...",
      "segments": []
    }
  ]
}
```

Errors:

- Empty `batches` array if no batches are written yet or job ID is unknown.

Frontend parsing:

- Sort by `batch_index`.
- Merge segments by `start`, `end`, and `label`.
- Render the first non-empty batch immediately.
- Segment times are already absolute song times.
- Use `elapsed_seconds` to compare batch sizes and tune the best batch duration.
- While the job is still running, pause playback at the last analyzed segment end if the next batch is not available yet, then resume when coverage extends.

Boundary handling:

- Batched analysis uses a small context padding window around each batch to reduce model boundary artifacts.
- Padding segments are trimmed before being returned, so the client only receives chord segments for the real batch time range.
- Very short leading `N` segments at a batch boundary are suppressed when immediately followed by a real chord, reducing false no-chord flashes from chunk warm-up.

## `GET /analysis/jobs/{job_id}/timeline`

Gets the exact timeline for a specific job.

Path params:

- `job_id`: analysis job ID.

Success response:

```json
{
  "song": {},
  "job": {},
  "segments": [],
  "batches": []
}
```

Errors:

- `404`: job not found.

Use this when:

- The UI is following one preview or batched job.
- You do not want the backend to automatically choose a different completed job.

## `GET /songs/{song_id}/timeline`

Gets the best completed timeline for a song.

Path params:

- `song_id`: song ID.

Success response:

```json
{
  "song": {},
  "job": {},
  "segments": [],
  "batches": []
}
```

Errors:

- `404`: song not found or no completed analysis exists.

Selection rule:

- Prefer completed `full_song`.
- Then `practice`.
- Then `batched`.
- Then other completed modes.

Corrections:

- Saved corrections are applied over raw engine segments in this response.

## `POST /songs/{song_id}/corrections`

Replaces saved chord corrections for a song.

Path params:

- `song_id`: song ID.

Request headers:

```text
Content-Type: application/json
```

Request body:

```json
{
  "corrections": [
    {
      "start": 12,
      "end": 16,
      "label": "G:7"
    }
  ]
}
```

Success response: same shape as timeline response.

Errors:

- `400`: invalid chord label or correction range.
- `404`: song not found or no completed analysis exists.

Behavior:

- This replaces all corrections for the song.
- Corrected segments are normalized through the chord parser.
- Corrected segments are returned with `corrected: true` and `source: "correction"`.

## `GET /songs/{song_id}/exports/chords`

Gets export-friendly chord rows.

Path params:

- `song_id`: song ID.

Success response:

```json
{
  "song_id": "54bf83df33601875",
  "rows": [
    {
      "start": "0.600",
      "end": "5.200",
      "chord": "A",
      "root": "A",
      "quality": "Major",
      "notes": "A C# E",
      "source": "lv-chordia"
    }
  ]
}
```

Errors:

- `404`: song not found or no completed analysis exists.

Frontend use:

- Convert `rows` to CSV, ChordPro, JSON, PDF, or clipboard output.
- Export rows include corrections because they are built from the corrected timeline.

## Test Flow

1. `GET /health`
2. `POST /songs/upload` with an audio file, or `POST /songs/import` with a trusted local path.
3. `POST /analysis/jobs` with `preview`, `batched`, or `full_song`.
4. Poll `GET /analysis/jobs/{job_id}`.
5. Poll `GET /analysis/jobs/{job_id}/batches` and render first available chords.
6. Fetch `GET /analysis/jobs/{job_id}/timeline` when completed.
7. Optional: `POST /songs/{song_id}/corrections`.
8. Optional: `GET /songs/{song_id}/exports/chords`.
