from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent


@dataclass(frozen=True)
class BackendConfig:
    """Runtime settings for the local analysis service."""

    database_path: Path = PROJECT_ROOT / "cache" / "backend" / "dechord_backend.sqlite3"
    work_dir: Path = PROJECT_ROOT / "cache" / "backend" / "work"
    upload_dir: Path = PROJECT_ROOT / "cache" / "backend" / "uploads"
    default_engine: str = "lv-chordia"
    default_dictionary: str = "submission"
    default_batch_seconds: float = 30.0
    default_preview_seconds: float = 30.0
    batch_context_seconds: float = 2.0
    leading_no_chord_suppression_seconds: float = 0.75
    min_batch_seconds: float = 5.0
    max_batch_seconds: float = 120.0

    def ensure_directories(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
