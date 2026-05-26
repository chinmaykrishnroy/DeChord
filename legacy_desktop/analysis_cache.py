import hashlib
import os


def cache_file_for_audio(audio_path, cache_dir, suffix=".txt", engine_id="madmom"):
    os.makedirs(cache_dir, exist_ok=True)
    cache_key = audio_content_hash(audio_path, engine_id=engine_id)
    return os.path.join(cache_dir, f"{cache_key}{suffix}")


def audio_content_hash(audio_path, engine_id="madmom"):
    digest = hashlib.sha256()
    digest.update(engine_id.encode("utf-8"))
    digest.update(b"\0")
    with open(audio_path, "rb") as audio_file:
        for chunk in iter(lambda: audio_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
