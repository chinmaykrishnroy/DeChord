"""Shared lightweight global features when madmom is not installed.

One decode/STFT serves key and tempo; only the two estimates are retained.
These are estimates, not beat/downbeat annotations or a chord-recognition model.
"""

from functools import lru_cache
from pathlib import Path


def key_from_chroma(chroma):
    import numpy as np

    major = np.array(
        [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    )
    minor = np.array(
        [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    )
    vector = np.asarray(chroma).reshape(12)
    if not np.isfinite(vector).all() or float(vector.sum()) <= 0:
        return None
    notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    candidates = [
        (
            float(np.corrcoef(vector, np.roll(profile, root))[0, 1]),
            f"{notes[root]} {mode}",
        )
        for mode, profile in [("major", major), ("minor", minor)]
        for root in range(12)
    ]
    return max(candidates, key=lambda item: item[0])[1]


@lru_cache(maxsize=1)
def _analyze(path, modified, size):
    import librosa
    import numpy as np

    audio, sr = librosa.load(path, sr=22050, mono=True)
    if not len(audio) or float(np.max(np.abs(audio))) < 1e-6:
        return None, None
    power = np.abs(librosa.stft(audio, n_fft=2048, hop_length=512)) ** 2
    chroma = librosa.feature.chroma_stft(S=power, sr=sr).sum(axis=1)
    onset = librosa.onset.onset_strength(
        S=librosa.power_to_db(power), sr=sr, hop_length=512
    )
    tempo = (
        float(librosa.feature.tempo(onset_envelope=onset, sr=sr, hop_length=512)[0])
        if float(onset.max()) > 1e-6
        else None
    )
    return key_from_chroma(chroma), round(tempo, 2) if tempo else None


def global_features(audio_path):
    path = Path(audio_path)
    stat = path.stat()
    return _analyze(str(path.resolve()), stat.st_mtime_ns, stat.st_size)
