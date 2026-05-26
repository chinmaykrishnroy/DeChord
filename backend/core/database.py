from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .config import BackendConfig


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    title TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    duration REAL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    engine TEXT NOT NULL,
    dictionary TEXT,
    key_label TEXT,
    tempo_bpm REAL,
    batch_seconds REAL,
    preview_seconds REAL,
    force INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_song_mode
ON analysis_jobs(song_id, mode, engine, dictionary, status, created_at);

CREATE TABLE IF NOT EXISTS analysis_batches (
    job_id TEXT NOT NULL,
    batch_index INTEGER NOT NULL,
    start REAL NOT NULL,
    end REAL,
    status TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    engine TEXT NOT NULL,
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    elapsed_seconds REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(job_id, batch_index),
    FOREIGN KEY(job_id) REFERENCES analysis_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chord_segments (
    job_id TEXT NOT NULL,
    batch_index INTEGER NOT NULL,
    segment_index INTEGER NOT NULL,
    start REAL NOT NULL,
    end REAL NOT NULL,
    label TEXT NOT NULL,
    root TEXT,
    quality TEXT,
    bass TEXT,
    notes_json TEXT NOT NULL,
    intervals_json TEXT NOT NULL,
    confidence REAL,
    corrected INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    PRIMARY KEY(job_id, batch_index, segment_index),
    FOREIGN KEY(job_id, batch_index) REFERENCES analysis_batches(job_id, batch_index) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_segments_job_time
ON chord_segments(job_id, start, end);

CREATE TABLE IF NOT EXISTS chord_corrections (
    song_id TEXT NOT NULL,
    correction_index INTEGER NOT NULL,
    start REAL NOT NULL,
    end REAL NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(song_id, correction_index),
    FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS song_lyrics (
    song_id TEXT PRIMARY KEY,
    lyrics_text TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    provider TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE
);
"""


class AnalysisDatabase:
    """Small SQLite wrapper used by repositories."""

    def __init__(self, path: str | Path | None = None, config: BackendConfig | None = None) -> None:
        self.config = config or BackendConfig()
        self.path = Path(path) if path is not None else self.config.database_path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def initialize(self) -> None:
        connection = sqlite3.connect(self.path)
        try:
            connection.executescript(SCHEMA)
            self._migrate(connection)
            connection.commit()
        finally:
            connection.close()

    def _migrate(self, connection: sqlite3.Connection) -> None:
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(analysis_batches)").fetchall()
        }
        migrations = {
            "started_at": "ALTER TABLE analysis_batches ADD COLUMN started_at TEXT",
            "completed_at": "ALTER TABLE analysis_batches ADD COLUMN completed_at TEXT",
            "elapsed_seconds": "ALTER TABLE analysis_batches ADD COLUMN elapsed_seconds REAL",
        }
        for column, statement in migrations.items():
            if column not in columns:
                connection.execute(statement)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
