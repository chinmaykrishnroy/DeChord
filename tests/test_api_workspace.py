import unittest
import threading
from fastapi import FastAPI
from fastapi.testclient import TestClient
import test_backend_audio_service as fixtures
from backend.app.routes import build_router
from backend.services.lyrics_service import _pick_lrclib_result
from backend.services.job_queue import AnalysisQueue


class ApiWorkspaceTests(unittest.TestCase):
    setUp = fixtures.BackendAudioServiceTests.setUp
    tearDown = fixtures.BackendAudioServiceTests.tearDown

    def test_library_source_and_incremental_stream(self):
        router = build_router(self.service)
        app = FastAPI()
        app.include_router(router)
        try:
            with TestClient(app) as client:
                response = client.post(
                    "/songs/upload",
                    files={"file": ("song.wav", b"fixture-audio", "audio/wav")},
                )
                self.assertEqual(response.status_code, 200)
                song = response.json()
                self.assertEqual(len(client.get("/songs").json()["songs"]), 1)
                job = self.service.create_analysis_job(
                    song["id"], mode="batched", batch_seconds=30
                )
                self.assertEqual(
                    client.get(f"/songs/{song['id']}/audio").content, b"fixture-audio"
                )
                events = client.get(f"/analysis/jobs/{job.id}/events?after=2")
                self.assertEqual(events.status_code, 200)
                import json

                data = json.loads(events.text.split("data: ", 1)[1])
                self.assertEqual([b["batch_index"] for b in data["batches"]], [3])
                self.assertEqual(data["job"]["status"], "completed")
        finally:
            router.analysis_queue.close()

    def test_duplicate_queue_submission_runs_once(self):
        entered = threading.Event()
        release = threading.Event()
        finished = threading.Event()

        class Service:
            count = 0

            def run_job(self, id):
                self.count += 1
                entered.set()
                release.wait(3)
                finished.set()

        service = Service()
        queue = AnalysisQueue(service)
        try:
            queue.submit("one")
            self.assertTrue(entered.wait(2))
            queue.submit("one")
            release.set()
            self.assertTrue(finished.wait(2))
            self.assertEqual(service.count, 1)
        finally:
            release.set()
            queue.close()

    def test_synced_lyrics_preferred_over_plain_close_match(self):
        plain = {
            "trackName": "Song",
            "artistName": "Artist",
            "duration": 100,
            "plainLyrics": "plain",
        }
        synced = {
            "trackName": "Song",
            "artistName": "Artist",
            "duration": 102,
            "syncedLyrics": "[00:01]line",
        }
        self.assertEqual(
            _pick_lrclib_result([plain, synced], 100, "Song", "Artist"), synced
        )
        self.assertIsNone(
            _pick_lrclib_result(
                [synced], 100, "Entirely different title", "Wrong person"
            )
        )

    def test_lv_session_is_loaded_once_for_repeated_inference(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        from backend.engines.chord import LvChordiaEngine

        counts = {"loads": 0, "inferences": 0, "releases": 0}

        class Session:
            def __init__(self, **kwargs):
                pass

            def load(self):
                counts["loads"] += 1

            def infer(self, path):
                counts["inferences"] += 1
                return [{"start_time": 0, "end_time": 1, "chord": "C:maj"}]

            def release(self):
                counts["releases"] += 1

        with (
            patch.dict(
                "sys.modules", {"lv_chordia": SimpleNamespace(LVChordiaSession=Session)}
            ),
            patch("backend.engines.chord.importlib.util.find_spec", return_value=True),
        ):
            engine = LvChordiaEngine(
                config=self.config, media_tools=self.service.media_tools
            )
            engine._recognize_raw("first.wav")
            engine._recognize_raw("second.wav")
            engine.close()
        self.assertEqual(counts, {"loads": 1, "inferences": 2, "releases": 1})


if __name__ == "__main__":
    unittest.main()
