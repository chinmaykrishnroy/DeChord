import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.app.auth import EngineTokenMiddleware


class EngineAuthTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.add_middleware(EngineTokenMiddleware, token="test-session")

        @app.get("/{path:path}")
        def endpoint(path: str):
            return {"path": path}

        self.client = TestClient(app)

    def test_api_requires_the_per_launch_bearer_token(self):
        self.assertEqual(self.client.get("/songs").status_code, 401)
        self.assertEqual(
            self.client.get(
                "/songs", headers={"Authorization": "Bearer wrong"}
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.get(
                "/songs", headers={"Authorization": "Bearer test-session"}
            ).status_code,
            200,
        )

    def test_query_tokens_are_limited_to_media_and_events(self):
        for path in ("/songs/a/audio", "/songs/a/artwork", "/analysis/jobs/a/events"):
            self.assertEqual(
                self.client.get(path + "?token=test-session").status_code, 200
            )
        self.assertEqual(self.client.get("/songs?token=test-session").status_code, 401)
        self.assertEqual(
            self.client.post("/songs/a/audio?token=test-session").status_code, 401
        )
