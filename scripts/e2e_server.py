"""Deterministic browser-test server. Fixture labels are not inference accuracy evidence."""

from pathlib import Path
import array
import math
import sys
import tempfile
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    import uvicorn
    from fastapi import FastAPI
    from fastapi.staticfiles import StaticFiles
    from backend.app.routes import build_router
    from backend.core.config import BackendConfig
    from backend.engines.chord import build_chord_segment
    from backend.services.analysis_service import AnalysisService

    class Chords:
        engine_id = "e2e-fixture"

        def recognize(self, path, start=0, duration=None):
            return [
                build_chord_segment(i * 6, (i + 1) * 6, label, source=self.engine_id)
                for i, label in enumerate(["G", "C", "D"])
            ]

    class Key:
        engine_id = "e2e-fixture"

        def estimate(self, path):
            return "G major"

    class Tempo:
        engine_id = "e2e-fixture"

        def estimate(self, path):
            return 100.0

    with tempfile.TemporaryDirectory(prefix="dechord-e2e-") as directory:
        folder = Path(directory)
        config = BackendConfig(
            database_path=folder / "songs.db",
            work_dir=folder / "work",
            upload_dir=folder / "uploads",
        )
        service = AnalysisService(
            config=config, chord_engine=Chords(), key_engine=Key(), tempo_engine=Tempo()
        )
        for index in range(6):
            path = folder / f"E2E Song {index + 1}.wav"
            rate = 8000
            samples = array.array(
                "h",
                (
                    int(3000 * math.sin(2 * math.pi * (220 + index * 30) * i / rate))
                    for i in range(rate * 18)
                ),
            )
            with wave.open(str(path), "wb") as audio:
                audio.setparams((1, 2, rate, 0, "NONE", "not compressed"))
                audio.writeframes(samples.tobytes())
            song = service.import_song(str(path))
            job = service.create_analysis_job(song.id, mode="full_song")
            service.run_job(job.id)
            service.save_lyrics(
                song.id,
                "[00:00.00]First line\n[00:06.00]Second line\n[00:12.00]Third line",
                synced=True,
                source="manual",
            )
        router = build_router(service)
        app = FastAPI()
        app.include_router(router)
        app.mount("/", StaticFiles(directory=ROOT / "frontend/dist", html=True))
        try:
            uvicorn.run(app, host="127.0.0.1", port=8765, access_log=False)
        finally:
            router.analysis_queue.close()


if __name__ == "__main__":
    main()
