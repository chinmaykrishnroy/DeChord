import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import test_backend_audio_service as fixtures
from backend.app.routes import build_router
from backend.services.artwork_service import ArtworkService


class ArtworkCacheTests(unittest.TestCase):
    def test_cover_is_cached_and_source_changes_invalidate_it(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "song.mp3"
            source.write_bytes(b"first audio")
            covers = ArtworkService(root / "artwork")

            def extract(audio, output):
                output.write_bytes(b"jpeg cover")
                return True

            with patch.object(covers.media, "extract_artwork", side_effect=extract) as extraction:
                first = covers.thumbnail(str(source))
                self.assertEqual(first.read_bytes(), b"jpeg cover")
                self.assertEqual(covers.thumbnail(str(source)), first)
                self.assertEqual(extraction.call_count, 1)
                source.write_bytes(b"changed audio and cover")
                self.assertNotEqual(covers.thumbnail(str(source)), first)
                self.assertEqual(extraction.call_count, 2)
            # A fresh service can reuse the on-disk cover without invoking FFmpeg.
            with patch("backend.core.media.MediaTools.extract_artwork") as extraction:
                self.assertIsNotNone(ArtworkService(root / "artwork").thumbnail(str(source)))
                extraction.assert_not_called()

    def test_missing_artwork_is_cached_and_partial_files_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "plain.wav"
            source.write_bytes(b"audio without artwork")
            covers = ArtworkService(root / "artwork")

            def no_artwork(audio, output):
                output.write_bytes(b"partial")
                return False

            with patch.object(covers.media, "extract_artwork", side_effect=no_artwork) as extraction:
                self.assertIsNone(covers.thumbnail(str(source)))
                self.assertIsNone(covers.thumbnail(str(source)))
                self.assertEqual(extraction.call_count, 1)
                self.assertEqual(list(covers.cache_dir.iterdir()), [])


class ArtworkApiTests(unittest.TestCase):
    setUp = fixtures.BackendAudioServiceTests.setUp
    tearDown = fixtures.BackendAudioServiceTests.tearDown

    def test_artwork_route_serves_small_image_and_missing_songs_return_404(self):
        song = self.service.import_song(str(self.audio))
        router = build_router(self.service)
        app = FastAPI()
        app.include_router(router)

        def extract(audio, output):
            output.write_bytes(b"jpeg cover")
            return True

        try:
            with patch("backend.core.media.MediaTools.extract_artwork", side_effect=extract) as extraction:
                with TestClient(app) as client:
                    response = client.get(f"/songs/{song.id}/artwork")
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.content, b"jpeg cover")
                    self.assertEqual(response.headers["content-type"], "image/jpeg")
                    self.assertIn("max-age", response.headers["cache-control"])
                    client.get(f"/songs/{song.id}/artwork")
                    self.assertEqual(client.get("/songs/unknown/artwork").status_code, 404)
                    self.assertEqual(extraction.call_count, 1)
        finally:
            router.analysis_queue.close()

    def test_songs_without_artwork_return_404_for_icon_fallback(self):
        song = self.service.import_song(str(self.audio))
        router = build_router(self.service)
        app = FastAPI()
        app.include_router(router)
        try:
            with patch("backend.core.media.MediaTools.extract_artwork", return_value=False):
                with TestClient(app) as client:
                    self.assertEqual(client.get(f"/songs/{song.id}/artwork").status_code, 404)
        finally:
            router.analysis_queue.close()
