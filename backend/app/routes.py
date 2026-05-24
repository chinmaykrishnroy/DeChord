from __future__ import annotations

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

    return router
