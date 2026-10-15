import tempfile
import unittest
from pathlib import Path

from scripts.run_studio import backend_owner
from backend.core.runtime import source_revision


class LauncherTests(unittest.TestCase):
    def test_stale_engine_owner_requires_exact_workspace_and_port(self):
        root = Path('C:/Studio/DeChord')
        processes = [
            {'ProcessId': 10, 'ParentProcessId': 1, 'CommandLine': '"C:\\Studio\\DeChord\\.venv\\Scripts\\python.exe" -m uvicorn backend.app.main:app --port 8765'},
            {'ProcessId': 11, 'ParentProcessId': 10, 'CommandLine': 'python -c "from multiprocessing.spawn import spawn_main; spawn_main()"'},
        ]
        self.assertEqual(backend_owner(processes,11,root),10)
        self.assertIsNone(backend_owner(processes,11,Path('C:/Other/DeChord')))
        self.assertIsNone(backend_owner(processes,99,root))
        processes[0]['CommandLine'] += '0'
        self.assertIsNone(backend_owner(processes,11,root))

    def test_engine_revision_changes_with_code_but_not_cache_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'backend').mkdir()
            source=root/'backend'/'app.py'
            source.write_text('version = 1')
            first=source_revision(root)
            (root/'backend'/'cover.jpg').write_bytes(b'cached artwork')
            self.assertEqual(first,source_revision(root))
            source.write_text('version = 2')
            self.assertNotEqual(first,source_revision(root))
