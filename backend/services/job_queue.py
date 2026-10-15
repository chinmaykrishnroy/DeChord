"""One bounded inference lane per local backend process, with duplicate submission protection."""

from concurrent.futures import ThreadPoolExecutor
from threading import Lock


class AnalysisQueue:
    def __init__(self, service, capacity=8):
        self.service = service
        self.capacity = capacity
        self.executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="dechord-analysis"
        )
        self.pending = set()
        self.lock = Lock()

    def submit(self, job_id):
        with self.lock:
            if job_id in self.pending:
                return
            if len(self.pending) >= self.capacity:
                raise RuntimeError("Analysis queue is full. Wait for a song to finish.")
            self.pending.add(job_id)
        try:
            self.executor.submit(self._run, job_id)
        except Exception:
            with self.lock:
                self.pending.discard(job_id)
            raise

    def _run(self, job_id):
        try:
            self.service.run_job(job_id)
        finally:
            with self.lock:
                self.pending.discard(job_id)

    def close(self):
        self.executor.shutdown(wait=False, cancel_futures=True)
