import json
import sys

try:
    from .audio_runtime import ensure_ffmpeg_available
    from .chord_types import normalize_chord_label
except ImportError:
    from audio_runtime import ensure_ffmpeg_available
    from chord_types import normalize_chord_label


def recognize(audio_path, chord_dict_name):
    ensure_ffmpeg_available()
    from lv_chordia.chord_recognition import chord_recognition

    results = chord_recognition(audio_path, chord_dict_name=chord_dict_name)
    return [
        (
            float(segment["start_time"]),
            float(segment["end_time"]),
            normalize_chord_label(segment["chord"]),
        )
        for segment in results
    ]


def main(argv):
    if len(argv) != 3:
        print("Usage: advanced_chord_worker.py AUDIO_PATH CHORD_DICT", file=sys.stderr)
        return 2

    audio_path = argv[1]
    chord_dict_name = argv[2]
    chords = recognize(audio_path, chord_dict_name)
    print(json.dumps(chords))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
