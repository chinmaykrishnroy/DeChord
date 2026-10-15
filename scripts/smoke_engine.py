"""Exercise the actual frozen engine, including inference, without installed Python imports."""

import argparse
import array
import json
import math
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import wave


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("binary", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="dechord-binary-") as folder:
        folder = Path(folder)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        token = secrets.token_urlsafe(32)
        environment = {
            **os.environ,
            "DECHORD_DATA_DIR": str(folder / "data"),
            "DECHORD_ENGINE_TOKEN": token,
            "NUMBA_CACHE_DIR": str(folder / "numba"),
            "OMP_NUM_THREADS": "2",
        }
        base = f"http://127.0.0.1:{port}"

        def request(path, payload=None):
            data = json.dumps(payload).encode() if payload is not None else None
            with urlopen(
                Request(
                    base + path,
                    data=data,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                ),
                timeout=30,
            ) as response:
                return json.load(response)

        with (folder / "engine.log").open("wb") as log:
            child = subprocess.Popen(
                [str(args.binary.resolve()), "--port", str(port), "--owned"],
                stdin=subprocess.PIPE,
                stdout=log,
                stderr=log,
                env=environment,
            )
            try:
                deadline = time.monotonic() + 60
                while True:
                    try:
                        health = request("/health")
                        break
                    except (URLError, TimeoutError, ConnectionError):
                        if child.poll() is not None or time.monotonic() > deadline:
                            raise RuntimeError(
                                (folder / "engine.log").read_text(errors="replace")
                            )
                        time.sleep(0.2)
                assert health["version"] == "1.0.0", health
                try:
                    urlopen(base + "/songs", timeout=5)
                    raise AssertionError(
                        "Private engine accepted an unauthenticated request"
                    )
                except HTTPError as error:
                    assert error.code == 401
                caps = request("/capabilities")
                assert (
                    caps["analysis_ready"]
                    and caps["engines"]["lv-chordia"]
                    and caps["ffmpeg"]
                ), caps
                path = folder / "practice.wav"
                rate = 22050
                samples = array.array(
                    "h",
                    (
                        int(
                            4000
                            * sum(
                                math.sin(2 * math.pi * f * i / rate)
                                for f in [261.63, 329.63, 392]
                            )
                            / 3
                        )
                        for i in range(rate * 12)
                    ),
                )
                with wave.open(str(path), "wb") as audio:
                    audio.setparams((1, 2, rate, 0, "NONE", "not compressed"))
                    audio.writeframes(samples.tobytes())
                song = request("/songs/import", {"path": str(path)})
                job = request(
                    "/analysis/jobs", {"song_id": song["id"], "mode": "full_song"}
                )
                deadline = time.monotonic() + 240
                while (
                    job["status"] not in ("completed", "failed", "cancelled")
                    and time.monotonic() < deadline
                ):
                    time.sleep(0.5)
                    job = request(f"/analysis/jobs/{job['id']}")
                assert job["status"] == "completed", job
                timeline = request(f"/songs/{song['id']}/timeline")
                assert timeline["segments"], timeline
                with urlopen(
                    Request(
                        base + f"/songs/{song['id']}/audio?token={token}",
                        headers={"Range": "bytes=0-15"},
                    ),
                    timeout=10,
                ) as audio:
                    assert audio.status == 206 and len(audio.read()) == 16
                print(
                    json.dumps(
                        {
                            "binary": str(args.binary),
                            "health": health,
                            "engine": caps["selected_engine"],
                            "segments": len(timeline["segments"]),
                            "inference": "passed",
                        }
                    ),
                    flush=True,
                )
            finally:
                child.stdin.close()
                try:
                    child.wait(timeout=12)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
                    raise AssertionError("Engine did not stop when its owner closed")
                if child.returncode:
                    print(
                        (folder / "engine.log").read_text(errors="replace"), flush=True
                    )
            assert child.returncode == 0, child.returncode


if __name__ == "__main__":
    main()
