from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routes import build_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="DeChord Local Analysis Engine",
        version="0.1.0",
        description="Offline audio analysis backend for DeChord.",
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
    app.include_router(build_router())
    return app


app = create_app()
