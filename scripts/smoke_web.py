"""Verify a running image serves the shared UI and completes real inference."""

import array
import io
import json
import math
import time
from urllib.error import URLError
from urllib.request import Request, urlopen
import wave


def main():
    base = "http://127.0.0.1:8765"

    def request(path, data=None, content_type="application/json"):
        with urlopen(
            Request(base + path, data=data, headers={"Content-Type": content_type}),
            timeout=30,
        ) as response:
            return json.load(response)

    deadline = time.monotonic() + 60
    while True:
        try:
            health = request("/health")
            break
        except (URLError, TimeoutError, ConnectionError):
            if time.monotonic() > deadline:
                raise
            time.sleep(0.5)
    assert health["version"] == "1.0.0", health
    with urlopen(base, timeout=10) as response:
        assert b"DeChord" in response.read()
    assert request("/capabilities")["analysis_ready"]
    audio_data = io.BytesIO()
    rate = 22050
    with wave.open(audio_data, "wb") as audio:
        audio.setparams((1, 2, rate, 0, "NONE", "not compressed"))
        audio.writeframes(
            array.array(
                "h",
                (
                    int(3000 * math.sin(2 * math.pi * 261.63 * i / rate))
                    for i in range(rate * 12)
                ),
            ).tobytes()
        )
    boundary = "dechord-ci-boundary"
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="practice.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode()
        + audio_data.getvalue()
        + f"\r\n--{boundary}--\r\n".encode()
    )
    song = request("/songs/upload", body, f"multipart/form-data; boundary={boundary}")
    job = request(
        "/analysis/jobs",
        json.dumps({"song_id": song["id"], "mode": "full_song"}).encode(),
    )
    deadline = time.monotonic() + 240
    while (
        job["status"] not in ("completed", "failed", "cancelled")
        and time.monotonic() < deadline
    ):
        time.sleep(0.5)
        job = request(f"/analysis/jobs/{job['id']}")
    assert job["status"] == "completed", job
    assert request(f"/songs/{song['id']}/timeline")["segments"]
    print(
        json.dumps({"web": "ready", "inference": "passed", "health": health}),
        flush=True,
    )


if __name__ == "__main__":
    main()
