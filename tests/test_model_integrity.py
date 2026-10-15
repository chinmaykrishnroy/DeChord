import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from backend.core.integrity import verify_models


class ModelIntegrityTests(unittest.TestCase):
    def test_packaged_checkpoints_must_all_exist_and_match_the_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cache = root / "cache_data"
            cache.mkdir()
            manifest = {}
            for index in range(5):
                name = f"model-{index}.sdict"
                content = f"checkpoint-{index}".encode()
                (cache / name).write_bytes(content)
                manifest[name] = hashlib.sha256(content).hexdigest()
            (root / "model-files.json").write_text(json.dumps(manifest))
            verify_models(root)
            (cache / "model-0.sdict").write_bytes(b"corrupt")
            with self.assertRaisesRegex(RuntimeError, "missing or damaged"):
                verify_models(root)
            (cache / "model-0.sdict").unlink()
            with self.assertRaisesRegex(RuntimeError, "missing or damaged"):
                verify_models(root)

    def test_incomplete_or_traversing_manifests_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "model-files.json").write_text("{}")
            with self.assertRaises(RuntimeError):
                verify_models(root)
            manifest = {
                "../outside": "hash",
                **{f"model-{i}": "hash" for i in range(4)},
            }
            (root / "model-files.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(RuntimeError, "Invalid packaged model path"):
                verify_models(root)
