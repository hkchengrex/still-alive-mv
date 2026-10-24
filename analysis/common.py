"""Shared paths / cache setup for the MV analysis scripts.

Import this module FIRST (before torch / huggingface / mlx imports) so that all
model downloads land in analysis/.cache/.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent          # analysis/
PROJECT = ROOT.parent                            # repo root
CACHE = ROOT / ".cache"
for var, sub in [("TORCH_HOME", "torch"), ("HF_HOME", "hf"), ("HF_HUB_CACHE", "hf/hub"),
                 ("XDG_CACHE_HOME", "xdg"), ("HUGGINGFACE_HUB_CACHE", "hf/hub"),
                 ("TRANSFORMERS_CACHE", "hf/transformers"), ("MPLCONFIGDIR", "mpl"),
                 ("NUMBA_CACHE_DIR", "numba"), ("UV_CACHE_DIR", "uv")]:
    os.environ.setdefault(var, str(CACHE / sub))
    (CACHE / sub).mkdir(parents=True, exist_ok=True)

AUDIO = PROJECT / "audio" / "mix.wav"      # THE SONG: the mixdown of the seven supplied tracks (0.454 x their sum, exactly), 179.199 s
TRACKS = PROJECT / "audio"                 # the multitrack set: drums_1 kick, drums_2 snare, drums_3 kit, guitar, rhythm = bass, vocals, song = backing (keys, pads)
STEMS = PROJECT / "stems"   # the supplied separated stems (bass, cymbals, drums, guitar, keys, kick, other, snare, vocals), on the song timeline
DATA = PROJECT / "data"
QA = ROOT / "qa"
WORK = ROOT / "work"          # intermediate results (whisper json, alignments)
QA.mkdir(exist_ok=True)
WORK.mkdir(exist_ok=True)
DATA.mkdir(exist_ok=True)


# The supplied stems are on the song timeline already: no offset.
STEM_OFFSET_SAMPLES = 0
STEM_OFFSET_SEC = STEM_OFFSET_SAMPLES / 44100


def load_track(name, sr=None, mono=True):
    """Load one of the supplied multitracks (audio/<name>.wav, on the song timeline)."""
    import soundfile as sf
    import numpy as np
    y, s = sf.read(TRACKS / f"{name}.wav", dtype="float32", always_2d=True)
    assert s == 44100
    y = y.mean(axis=1) if mono else y.T
    if sr and sr != s:
        import soxr
        y = soxr.resample(y, s, sr) if mono else np.stack([soxr.resample(c, s, sr) for c in y])
        s = sr
    return y, s


def load_stem(name, sr=None, mono=True):
    """Load a separated stem from stems/ (separated from audio/mix.wav; on the song timeline)."""
    import soundfile as sf
    import numpy as np
    y, s = sf.read(STEMS / f"{name}.wav", dtype="float32", always_2d=True)
    assert s == 44100
    y = y[STEM_OFFSET_SAMPLES:]
    y = y.mean(axis=1) if mono else y.T
    if sr and sr != s:
        import soxr
        y = soxr.resample(y, s, sr) if mono else np.stack([soxr.resample(c, s, sr) for c in y])
        s = sr
    return y, s


KARAOKE = ROOT / "stems" / "karaoke"


def load_lead(sr=None, mono=True):
    """Lead vocal only (mel-band-roformer karaoke model run on the mp3; already
    in gapless-mp3 time, no offset)."""
    import soundfile as sf
    import numpy as np
    y, s = sf.read(KARAOKE / "lead.wav", dtype="float32", always_2d=True)
    y = y.mean(axis=1) if mono else y.T
    if sr and sr != s:
        import soxr
        y = soxr.resample(y, s, sr) if mono else np.stack([soxr.resample(c, s, sr) for c in y])
        s = sr
    return y, s


def load_vocal_source(name, sr=None):
    """'vocals' = Demucs vocal stem (mono sum), 'vocL'/'vocR' = its left/right
    channel (choruses are double-tracked and panned L/R, so each channel is
    closer to a single voice), 'lead' = karaoke lead."""
    if name == "lead":
        return load_lead(sr)
    if name in ("vocL", "vocR"):
        y, s = load_stem("vocals", sr=sr, mono=False)
        return y[0 if name == "vocL" else 1], s
    return load_stem("vocals", sr=sr)


def load_mix(sr=44100, mono=True):
    import librosa
    y, s = librosa.load(str(AUDIO), sr=sr, mono=mono)
    return y, s
