"""Exercise owned process exit with a real busy executor, without loading models."""

import os
from pathlib import Path
import signal
import subprocess
import sys
import unittest


class DesktopLifecycleTests(unittest.TestCase):
    def run_owned_child(self, *, busy, isolated_group=False, starting=False):
        code = f"""
import sys, time, types
from concurrent.futures import ThreadPoolExecutor
class Server:
    def __init__(self, config): self.should_exit = False
    def run(self):
        if {busy!r}:
            pool = ThreadPoolExecutor(max_workers=1)
            pool.submit(time.sleep, 30)
        print('ready', flush=True)
        while not self.should_exit: time.sleep(.01)
sys.modules['uvicorn'] = types.SimpleNamespace(Server=Server, Config=lambda *a, **kw: None)
sys.modules['backend.app.main'] = types.SimpleNamespace(app=object())
from backend import desktop_entry
desktop_entry.OWNER_EXIT_TIMEOUT_SECONDS = {0.15 if busy or starting else 30}
if {starting!r}:
    sys.frozen = True
    def verify_models(_):
        print('ready', flush=True)
        time.sleep(30)
    sys.modules['backend.core.integrity'] = types.SimpleNamespace(verify_models=verify_models)
sys.argv = ['dechord-engine', '--owned']
desktop_entry.main()
"""
        with subprocess.Popen(
            [sys.executable, "-c", code],
            cwd=Path(__file__).resolve().parents[1],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=isolated_group,
        ) as child:
            try:
                self.assertEqual(child.stdout.readline().strip(), b"ready")
                child.stdin.close()
                try:
                    return child.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.fail(
                        "An analysis worker kept the engine alive after owner EOF"
                    )
            finally:
                if child.poll() is None:
                    child.kill()
                child.wait()

    def test_active_worker_cannot_outlive_owner_pipe(self):
        self.assertEqual(self.run_owned_child(busy=True), 0)

    def test_idle_engine_exits_without_waiting_for_force_deadline(self):
        self.assertEqual(self.run_owned_child(busy=False), 0)

    def test_engine_cannot_outlive_owner_during_cold_initialization(self):
        self.assertEqual(self.run_owned_child(busy=False, starting=True), 0)

    @unittest.skipUnless(os.name == "posix", "POSIX process groups")
    def test_busy_engine_terminates_its_private_process_group(self):
        self.assertEqual(
            self.run_owned_child(busy=True, isolated_group=True), -signal.SIGKILL
        )


if __name__ == "__main__":
    unittest.main()
