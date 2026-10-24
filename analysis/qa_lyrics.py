"""QA of the lyric alignment: the vocal track's spectrogram in strips with every word's start marked
and labelled (analysis/qa/lyrics_*.png), and a numeric check of each line's start against the
vocal track's energy rise.

Run:  uv run python qa_lyrics.py
"""
import common
import json
import sys

import numpy as np
import librosa

SR = 22050


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    doc = json.loads((common.DATA / "lyrics.json").read_text(encoding="utf-8"))
    lines = doc["lines"]
    y, _ = common.load_track("vocals", sr=SR)
    hop = 220  # 10 ms
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0]
    db = 20 * np.log10(rms + 1e-6)
    db -= db.max()
    thr = -35.0
    # energy rise: the last frame under the threshold before the line's start (searching 0.6 s either way)
    print("line  start   rise   delta   dur   words  text")
    worst = 0.0
    for i, l in enumerate(lines):
        s = l["start"]
        a, b = int((s - 0.6) / 0.01), int((s + 0.6) / 0.01)
        seg = db[a:b]
        above = np.where(seg > thr)[0]
        rise = (a + above[0]) * 0.01 if len(above) else float("nan")
        d = s - rise
        worst = max(worst, abs(d))
        print(f"L{i:<3d} {s:7.2f} {rise:7.2f} {d:+6.2f} {l['end'] - s:5.2f}  {len(l['words']):3d}   {l['text'][:40]}")
    print(f"largest |start - energy rise|: {worst:.2f} s")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    S = librosa.amplitude_to_db(np.abs(librosa.stft(y, n_fft=2048, hop_length=256)), ref=np.max)
    fps = SR / 256
    dur = len(y) / SR
    strip = 20.0
    for k in range(int(np.ceil(dur / strip))):
        t0, t1 = k * strip, min(dur, (k + 1) * strip)
        fig, ax = plt.subplots(1, 1, figsize=(24, 5))
        f0, f1 = int(t0 * fps), int(t1 * fps)
        ax.imshow(S[:, f0:f1], origin="lower", aspect="auto", cmap="magma", vmin=-70, vmax=0,
                  extent=[t0, t1, 0, SR / 2])
        ax.set_ylim(0, 5000)
        for l in lines:
            if l["end"] < t0 or l["start"] > t1:
                continue
            ax.axvline(l["start"], color="c", lw=2)
            ax.axvline(l["end"], color="c", lw=1, ls="--")
            for j, w in enumerate(l["words"]):
                if t0 <= w["start"] <= t1:
                    c = "w" if w["conf"] >= 0.3 else "r"
                    ax.axvline(w["start"], color=c, lw=0.8, alpha=0.8)
                    ax.text(w["start"] + 0.03, 4700 - (j % 3) * 450, w["w"], color=c, fontsize=9, rotation=0)
        ax.set_xticks(np.arange(np.ceil(t0), t1, 1.0))
        ax.set_xlabel("s")
        fig.tight_layout()
        fig.savefig(common.QA / f"lyrics_{int(t0):03d}.png", dpi=60)
        plt.close(fig)
    print("wrote", common.QA / "lyrics_*.png")


if __name__ == "__main__":
    main()
