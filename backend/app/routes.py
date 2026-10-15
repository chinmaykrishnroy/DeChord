from __future__ import annotations

import json
import asyncio
import importlib.util
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from pydantic import BaseModel, Field
from typing import Literal
from backend.services.guitar_service import plan_capo

from backend.core.config import BACKEND_ROOT
from backend.core.runtime import source_revision
from backend.version import __version__
from backend.core.media import MediaError
from backend.domain.models import Correction
from backend.services.analysis_service import AnalysisService
from backend.services.artwork_service import ArtworkService
from backend.services.job_queue import AnalysisQueue
from backend.services.lyrics_service import (
    _looks_synced_lyrics,
    _download_lrclib_lyrics,
)


class ImportSongRequest(BaseModel):
    path: str


class GuitarPlanChord(BaseModel):
    label: str = Field(max_length=40)
    duration: float = Field(default=1, gt=0, le=86400, allow_inf_nan=False)


class GuitarPlanRequest(BaseModel):
    chords: list[GuitarPlanChord] = Field(max_length=256)
    easy_shapes: list[str] | None = Field(default=None, max_length=64)
    mode: Literal["open", "barre"] = "open"
    capo: int | None = Field(default=None, ge=0, le=12)
    max_capo: int = Field(default=7, ge=0, le=12)


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


def build_router(service: AnalysisService | None = None) -> APIRouter:
    router = APIRouter()
    analysis_service = service or AnalysisService()
    artwork = ArtworkService(analysis_service.config.work_dir / "artwork")
    revision = source_revision(BACKEND_ROOT.parent)
    queue = AnalysisQueue(analysis_service)
    router.analysis_queue = queue

    @router.post("/guitar/plan")
    def guitar_plan(request: GuitarPlanRequest):
        return plan_capo(
            [c.model_dump() for c in request.chords],
            request.easy_shapes,
            request.mode,
            request.capo,
            request.max_capo,
        )

    @router.get("/tester", include_in_schema=False)
    def tester_alias() -> FileResponse:
        return FileResponse(BACKEND_ROOT / "test_backend.html")

    @router.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "dechord",
            "revision": revision,
            "version": __version__,
        }

    @router.get("/capabilities")
    def capabilities():
        engines = {
            name: importlib.util.find_spec(module) is not None
            for name, module in (("lv-chordia", "lv_chordia"), ("madmom", "madmom"))
        }
        return {
            "engines": engines,
            "analysis_ready": any(engines.values()),
            "selected_engine": analysis_service.chord_engine.engine_id,
            "key_engine": analysis_service.key_engine.engine_id,
            "tempo_engine": analysis_service.tempo_engine.engine_id,
            "streaming": True,
            "managed_library": True,
            "ffmpeg": bool(shutil.which("ffmpeg")),
            "queue_capacity": queue.capacity,
        }

    @router.get("/songs")
    def songs():
        return {
            "songs": [
                song.to_dict() for song in analysis_service.repository.list_songs()
            ]
        }

    @router.get("/songs/{song_id}/audio")
    def song_audio(song_id: str):
        song = analysis_service.repository.get_song(song_id)
        if song is None or not Path(song.path).is_file():
            raise HTTPException(
                status_code=404,
                detail="Source audio is unavailable. Reimport this song.",
            )
        return FileResponse(song.path)

    @router.get("/songs/{song_id}/artwork")
    def song_artwork(song_id: str):
        song = analysis_service.repository.get_song(song_id)
        if song is None:
            raise HTTPException(status_code=404, detail="Song not found.")
        try:
            thumbnail = artwork.thumbnail(song.path)
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=404, detail="Source audio is unavailable."
            ) from exc
        except MediaError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if thumbnail is None:
            raise HTTPException(
                status_code=404, detail="This song has no album artwork."
            )
        return FileResponse(
            thumbnail,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "private, max-age=86400",
            },
        )

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
            raise HTTPException(
                status_code=400, detail="Upload field 'file' is required."
            )
        try:
            song = await run_in_threadpool(
                analysis_service.import_uploaded_song,
                upload.filename or "audio",
                upload.file,
            )
            return song.to_dict()
        except ValueError as exc:
            raise HTTPException(status_code=413, detail=str(exc)) from exc
        except MediaError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        finally:
            await upload.close()

    @router.post("/analysis/jobs")
    def create_job(request: AnalysisJobRequest) -> dict[str, Any]:
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
                queue.submit(job.id)
            return job.to_dict()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=429, detail=str(exc)) from exc

    @router.get("/analysis/jobs/{job_id}/events")
    async def job_events(job_id: str, request: Request, after: int = -1):
        if analysis_service.get_job(job_id) is None:
            raise HTTPException(status_code=404, detail="Job not found")

        async def events():
            cursor = after
            signature = None
            ticks = 0
            while not await request.is_disconnected():
                job = await run_in_threadpool(analysis_service.get_job, job_id)
                if job is None:
                    break
                batches = await run_in_threadpool(
                    analysis_service.repository.list_batches, job_id, True, cursor, True
                )
                next_signature = (job.status, job.progress, job.updated_at)
                if batches or signature != next_signature:
                    payload = {
                        "job": job.to_dict(),
                        "batches": [batch.to_dict() for batch in batches],
                    }
                    yield f"data: {json.dumps(payload)}\n\n"
                    if batches:
                        cursor = max(batch.batch_index for batch in batches)
                    signature = next_signature
                elif ticks % 20 == 0:
                    yield ": keepalive\n\n"
                if job.status in {"completed", "failed", "cancelled"}:
                    break
                ticks += 1
                await asyncio.sleep(0.5)

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @router.get("/analysis/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, Any]:
        job = analysis_service.get_job(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
        return job.to_dict()

    @router.get("/analysis/jobs/{job_id}/batches")
    def get_batches(job_id: str) -> dict[str, Any]:
        return {
            "job_id": job_id,
            "batches": [
                batch.to_dict() for batch in analysis_service.get_batches(job_id)
            ],
        }

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
            raise HTTPException(
                status_code=502, detail=f"Lyric download failed: {exc}"
            ) from exc

    return router
