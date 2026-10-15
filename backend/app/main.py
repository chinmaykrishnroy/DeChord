from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from backend.core.config import PROJECT_ROOT

from backend.app.routes import build_router


def create_app() -> FastAPI:
    router = build_router()
    @asynccontextmanager
    async def lifespan(app):
        yield
        router.analysis_queue.close()
    app = FastAPI(
        title="DeChord Local Analysis Engine",
        version="0.1.0",
        description="Offline audio analysis backend for DeChord.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=(
            r"^(http://127\.0\.0\.1:\d+|http://localhost:\d+|"
            r"http://tauri\.localhost|tauri://localhost)$"
        ),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    frontend_dist = PROJECT_ROOT / 'frontend' / 'dist'
    if frontend_dist.is_dir():
        app.mount('/', StaticFiles(directory=frontend_dist, html=True), name='studio')
    return app


app = create_app()
