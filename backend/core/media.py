from __future__ import annotations

import json
import shutil
import subprocess
import uuid
from pathlib import Path

try:
    from legacy_desktop.audio_runtime import ensure_ffmpeg_available
except Exception:  # pragma: no cover - only used when imported outside the full app.
    ensure_ffmpeg_available = None  # type: ignore[assignment]


class MediaError(RuntimeError):
    """Raised when audio probing or extraction fails."""


class MediaTools:
    """FFmpeg-backed media operations for analysis jobs."""

    def __init__(self, work_dir: str | Path) -> None:
        self.work_dir = Path(work_dir)
        self.work_dir.mkdir(parents=True, exist_ok=True)

    def probe_duration(self, audio_path: str | Path) -> float | None:
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(str(path))
        self._ensure_ffmpeg()

        command = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            return None

        try:
            payload = json.loads(result.stdout or "{}")
            duration = float(payload["format"]["duration"])
            return duration if duration > 0 else None
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            return None

    def extract_piece(self, audio_path: str | Path, start: float, duration: float) -> Path:
        path = Path(audio_path)
        if duration <= 0:
            raise MediaError("Audio piece duration must be greater than zero.")
        if not path.exists():
            raise FileNotFoundError(str(path))
        self._ensure_ffmpeg()

        output = self.work_dir / f"piece-{uuid.uuid4().hex}.wav"
        command = [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{max(0.0, start):.3f}",
            "-t",
            f"{duration:.3f}",
            "-i",
            str(path),
            "-acodec",
            "pcm_s16le",
            "-ar",
            "44100",
            "-ac",
            "2",
            str(output),
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            raise MediaError(result.stderr.strip() or "FFmpeg failed to extract audio piece.")
        return output

    def _ensure_ffmpeg(self) -> None:
        if ensure_ffmpeg_available is not None and ensure_ffmpeg_available():
            return
        if shutil.which("ffmpeg") and shutil.which("ffprobe"):
            return
        raise MediaError("FFmpeg and ffprobe are unavailable for audio probing/extraction.")
