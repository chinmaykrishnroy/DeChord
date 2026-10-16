from __future__ import annotations

import hashlib
import threading
import uuid
from collections import deque
from pathlib import Path

from backend.core.media import MediaTools


class ArtworkService:
    """Small, reusable album covers without reading audio into API responses."""

    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = cache_dir
        self.media = MediaTools(cache_dir)
        self._lock = threading.Lock()
        self._missing: deque[str] = deque(maxlen=256)

    def thumbnail(self, audio_path: str) -> Path | None:
        source = Path(audio_path)
        stat = source.stat()
        key = hashlib.sha256(
            f"{source.resolve()}:{stat.st_size}:{stat.st_mtime_ns}".encode()
        ).hexdigest()
        output = self.cache_dir / f"{key}.jpg"
        with self._lock:
            if output.is_file():
                return output
            if key in self._missing:
                return None
            temporary = self.cache_dir / f"{key}-{uuid.uuid4().hex}.jpg"
            try:
                if not self.media.extract_artwork(source, temporary):
                    self._missing.append(key)
                    return None
                temporary.replace(output)
                return output
            finally:
                temporary.unlink(missing_ok=True)
