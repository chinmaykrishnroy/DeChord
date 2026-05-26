import os
import shutil
import subprocess
import tempfile

try:
    from .analysis_cache import audio_content_hash
except ImportError:
    from analysis_cache import audio_content_hash


def ensure_ffmpeg_available():
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        return True

    try:
        import static_ffmpeg
    except ImportError:
        return False

    try:
        static_ffmpeg.add_paths(weak=True)
    except Exception:
        return False

    return bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def friendly_audio_error(message):
    lower_message = message.lower()
    if "ffmpeg" in lower_message or "avconv" in lower_message or "could not load audio file" in lower_message:
        return (
            "Could not read this audio file. DeChord needs FFmpeg for MP3/M4A/AAC analysis. "
            "Close the app, run run.bat once to install/update dependencies, then try again."
        )
    return message


def playback_audio_path(audio_path):
    extension = os.path.splitext(audio_path)[1].lower()
    if extension == ".wav":
        return audio_path

    if not ensure_ffmpeg_available():
        raise RuntimeError("FFmpeg is unavailable for playback conversion.")

    cache_dir = os.path.join(tempfile.gettempdir(), "dechord_playback_cache")
    os.makedirs(cache_dir, exist_ok=True)
    wav_path = os.path.join(cache_dir, f"{audio_content_hash(audio_path, engine_id='playback-wav-v1')}.wav")
    if os.path.exists(wav_path):
        return wav_path

    ffmpeg = shutil.which("ffmpeg")
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            audio_path,
            "-acodec",
            "pcm_s16le",
            "-ar",
            "44100",
            "-ac",
            "2",
            wav_path,
        ],
        check=True,
    )
    return wav_path
