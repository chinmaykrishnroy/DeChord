import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import test_backend_audio_service as fixtures
from backend.app.routes import build_router
from backend.services.guitar_service import plan_capo

class GuitarPlanTests(unittest.TestCase):
    setUp = fixtures.BackendAudioServiceTests.setUp
    tearDown = fixtures.BackendAudioServiceTests.tearDown

    def plan(self, payload):
        router = build_router(self.service)
        app = FastAPI(); app.include_router(router)
        try:
            with TestClient(app) as client:
                response = client.post('/guitar/plan', json=payload)
                self.assertEqual(response.status_code, 200, response.text)
                return response.json()
        finally:
            router.analysis_queue.close()

    def test_auto_capo_matches_easy_progression(self):
        result = self.plan({'chords': [{'label': c, 'duration': 4} for c in ['F#', 'G#', 'C#', 'D#m']], 'easy_shapes': ['C', 'D', 'G', 'Am'], 'mode': 'open'})
        self.assertEqual(result['capo'], 6)
        self.assertEqual(result['easy_count'], 4)
        self.assertEqual(result['shape_labels'], ['C', 'D', 'G', 'Am'])

    def test_manual_capo_is_preserved(self):
        result = self.plan({'chords': [{'label': 'F#', 'duration': 8}], 'capo': 3, 'mode': 'barre'})
        self.assertEqual(result['capo'], 3)

    def test_duration_weighting_and_repeated_progression(self):
        first = [{'label': 'F#', 'duration': 100}, {'label': 'B', 'duration': 1}]
        second = [{'label': 'F#', 'duration': 1}, {'label': 'B', 'duration': 100}]
        self.assertEqual(plan_capo(first, ['E', 'C'])['capo'], 2)
        self.assertEqual(plan_capo(second, ['E', 'C'])['capo'], 7)
        self.assertEqual(plan_capo(first * 8, ['E', 'C'])['capo'], 2)

    def test_exact_extensions_and_slash_bass_are_not_simplified(self):
        result = plan_capo([{'label': 'C#maj9/G#', 'duration': 4}], capo=1)
        self.assertEqual(result['shape_labels'], ['CM9/G'])

    def test_desktop_import_path_and_audio_range_requests(self):
        router = build_router(self.service)
        app = FastAPI(); app.include_router(router)
        try:
            with TestClient(app) as client:
                song = client.post('/songs/import', json={'path': str(self.audio)}).json()
                response = client.get(f"/songs/{song['id']}/audio", headers={'Range': 'bytes=2-6'})
                self.assertEqual(response.status_code, 206)
                self.assertEqual(response.content, self.audio.read_bytes()[2:7])
                self.assertEqual(client.post('/guitar/plan',json={'chords':[],'capo':13}).status_code,422)
        finally:
            router.analysis_queue.close()

if __name__ == '__main__': unittest.main()
