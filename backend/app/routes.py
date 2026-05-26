from __future__ import annotations

import json
import re
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.datastructures import UploadFile
from pydantic import BaseModel

from backend.core.config import BACKEND_ROOT
from backend.core.media import MediaError
from backend.domain.models import Correction
from backend.services.analysis_service import AnalysisService


class ImportSongRequest(BaseModel):
    path: str


class AnalysisJobRequest(BaseModel):
    song_id: str
    mode: str = "full_song"
    batch_seconds: float | None = None
    preview_seconds: float | None = None
    force: bool = False


class CorrectionRequest(BaseModel):
    start: float
    end: float
    label: str


class CorrectionsRequest(BaseModel):
    corrections: list[CorrectionRequest]


class LyricsRequest(BaseModel):
    lyrics_text: str
    synced: bool = False
    source: str = "manual"
    provider: str | None = None


class LyricsDownloadRequest(BaseModel):
    title: str | None = None
    artist: str | None = None
    duration: float | None = None


def _looks_synced_lyrics(text: str) -> bool:
    return any(line.startswith("[") and ":" in line[:12] for line in text.splitlines())


_LOCAL_ARTISTS = {"", "local file", "local demo", "unknown artist"}


def _clean_lyric_lookup_text(value: str | None) -> str:
    text = (value or "").strip()
    text = re.sub(r"\.[A-Za-z0-9]{2,5}$", "", text)
    text = text.replace("_", " ")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(
        r"\s*(?:\(|\[)\s*(?:official|lyrics?|lyric video|audio|video|hd|4k).*$",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return text.strip(" -_")


def _split_artist_title(title: str, artist: str | None) -> tuple[str, str | None]:
    clean_title = _clean_lyric_lookup_text(title)
    clean_artist = _clean_lyric_lookup_text(artist)

    if clean_artist.lower() in _LOCAL_ARTISTS:
        clean_artist = ""

    if not clean_artist:
        parts = re.split(r"\s+[-–—]\s+", clean_title, maxsplit=1)
        if len(parts) == 2 and all(parts):
            clean_artist, clean_title = parts[0].strip(), parts[1].strip()

    return clean_title, clean_artist or None


def _lrclib_queries(title: str, artist: str | None, duration: float | None) -> list[dict[str, str]]:
    clean_title, clean_artist = _split_artist_title(title, artist)
    original_title = _clean_lyric_lookup_text(title)
    rounded_duration = str(round(duration)) if duration else None
    raw_queries: list[dict[str, str]] = []

    if clean_title:
        base = {"track_name": clean_title}
        if clean_artist:
            base["artist_name"] = clean_artist
        raw_queries.append({**base, **({"duration": rounded_duration} if rounded_duration else {})})
        raw_queries.append(base)

    if original_title and original_title != clean_title:
        raw_queries.append({"track_name": original_title})

    seen: set[tuple[tuple[str, str], ...]] = set()
    queries: list[dict[str, str]] = []
    for query in raw_queries:
        key = tuple(sorted(query.items()))
        if query.get("track_name") and key not in seen:
            seen.add(key)
            queries.append(query)
    return queries


def _pick_lrclib_result(payload: Any, duration: float | None) -> dict[str, Any] | None:
    if not isinstance(payload, list) or not payload:
        return None

    with_lyrics = [
        item for item in payload
        if isinstance(item, dict) and (item.get("syncedLyrics") or item.get("plainLyrics"))
    ]
    if not with_lyrics:
        return None

    if duration:
        return min(
            with_lyrics,
            key=lambda item: abs(float(item.get("duration") or duration) - duration),
        )

    return with_lyrics[0]


def _download_lrclib_lyrics(title: str, artist: str | None, duration: float | None) -> tuple[str, bool] | None:
    last_error: Exception | None = None
    for query in _lrclib_queries(title, artist, duration):
        url = f"https://lrclib.net/api/search?{urlencode(query)}"
        request = UrlRequest(url, headers={"User-Agent": "DeChord/0.1 local-desktop"})
        try:
            with urlopen(request, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last_error = exc
            continue

        best = _pick_lrclib_result(payload, duration)
        if best is None:
            continue

        synced = best.get("syncedLyrics")
        plain = best.get("plainLyrics")
        if synced:
            return str(synced), True
        if plain:
            return str(plain), False
    if last_error is not None:
        raise last_error
    return None


def build_router(service: AnalysisService | None = None) -> APIRouter:
    router = APIRouter()
    analysis_service = service or AnalysisService()

    @router.get("/", include_in_schema=False)
    def tester_page() -> FileResponse:
        return FileResponse(BACKEND_ROOT / "test_backend.html")

    @router.get("/tester", include_in_schema=False)
    def tester_alias() -> FileResponse:
        return FileResponse(BACKEND_ROOT / "test_backend.html")

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @router.post("/songs/import")
    def import_song(request: ImportSongRequest) -> dict[str, Any]:
        try:
            return analysis_service.import_song(request.path).to_dict()
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except MediaError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.post("/songs/upload")
    async def upload_song(request: Request) -> dict[str, Any]:
        try:
            form = await request.form()
        except AssertionError as exc:
            raise HTTPException(
                status_code=500,
                detail="File upload support requires python-multipart. Run backend/requirements-backend.txt install.",
            ) from exc

        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            raise HTTPException(status_code=400, detail="Upload field 'file' is required.")
        try:
            return analysis_service.import_uploaded_song(upload.filename or "audio", upload.file).to_dict()
        except MediaError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        finally:
            await upload.close()

    @router.post("/analysis/jobs")
    def create_job(request: AnalysisJobRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
        try:
            job = analysis_service.create_analysis_job(
                request.song_id,
                mode=request.mode,
                batch_seconds=request.batch_seconds,
                preview_seconds=request.preview_seconds,
                force=request.force,
                run_immediately=False,
            )
            if job.status in {"queued", "running", "failed"}:
                background_tasks.add_task(analysis_service.run_job, job.id)
            return job.to_dict()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/analysis/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, Any]:
        job = analysis_service.get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
        return job.to_dict()

    @router.get("/analysis/jobs/{job_id}/batches")
    def get_batches(job_id: str) -> dict[str, Any]:
        return {"job_id": job_id, "batches": [batch.to_dict() for batch in analysis_service.get_batches(job_id)]}

    @router.get("/analysis/jobs/{job_id}/timeline")
    def get_job_timeline(job_id: str) -> dict[str, Any]:
        try:
            return analysis_service.get_job_timeline(job_id).to_dict()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/songs/{song_id}/timeline")
    def get_timeline(song_id: str) -> dict[str, Any]:
        try:
            return analysis_service.get_timeline(song_id).to_dict()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post("/songs/{song_id}/corrections")
    def save_corrections(song_id: str, request: CorrectionsRequest) -> dict[str, Any]:
        corrections = [
            Correction(start=item.start, end=item.end, label=item.label)
            for item in request.corrections
        ]
        try:
            return analysis_service.save_corrections(song_id, corrections).to_dict()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/songs/{song_id}/exports/chords")
    def export_chords(song_id: str) -> dict[str, Any]:
        try:
            return {"song_id": song_id, "rows": analysis_service.export_chords(song_id)}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/songs/{song_id}/lyrics")
    def get_lyrics(song_id: str) -> dict[str, Any]:
        try:
            lyrics = analysis_service.get_lyrics(song_id)
            if lyrics is None:
                return {"song_id": song_id, "lyrics": None}
            return {"song_id": song_id, "lyrics": lyrics.to_dict()}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post("/songs/{song_id}/lyrics")
    def save_lyrics(song_id: str, request: LyricsRequest) -> dict[str, Any]:
        try:
            lyrics = analysis_service.save_lyrics(
                song_id,
                request.lyrics_text,
                synced=request.synced or _looks_synced_lyrics(request.lyrics_text),
                source=request.source,
                provider=request.provider,
            )
            return {"song_id": song_id, "lyrics": lyrics.to_dict()}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/songs/{song_id}/lyrics/download")
    def download_lyrics(song_id: str, request: LyricsDownloadRequest) -> dict[str, Any]:
        try:
            song = analysis_service.repository.get_song(song_id)
            if song is None:
                raise KeyError(f"Song not found: {song_id}")
            result = _download_lrclib_lyrics(
                request.title or song.title,
                request.artist,
                request.duration or song.duration,
            )
            if result is None:
                raise HTTPException(status_code=404, detail="No lyrics found.")
            lyrics_text, synced = result
            lyrics = analysis_service.save_lyrics(
                song_id,
                lyrics_text,
                synced=synced,
                source="internet",
                provider="lrclib",
            )
            return {"song_id": song_id, "lyrics": lyrics.to_dict()}
        except HTTPException:
            raise
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Lyric download failed: {exc}") from exc

    return router
