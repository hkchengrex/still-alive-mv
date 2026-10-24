"""Music analysis -> data/audio.json

  * constant-tempo beat grid (tempo + phase fitted to drum / mix onsets, phase
    refined on kick attacks), downbeats (bar phase from snare-on-2&4 and the
    lyric phrases starting on bars), sections on downbeats,
  * 100 fps normalized envelopes (mix rms / low / mid / high, stem rms),
  * kick / snare / hat onsets from the drums stem, vocal note onsets.

All times are on the audio/mix.wav timeline (the song; the seven supplied tracks sum to it). The grid starts on the
song's first beat, 0.49 s, a pickup; bar 0 starts on the next beat, 0.99 s, and a bar is 2.000 s at 120.0 BPM.

Run:  uv run python analyze.py [--plots]
"""
import common
import json
import math
import sys

import numpy as np
import librosa
from scipy.ndimage import maximum_filter1d, median_filter, uniform_filter1d
from scipy.signal import butter, find_peaks, sosfiltfilt

SR = 44100
FPS = 100

BPM_RANGE = (100.0, 135.0)  # the song sits near 118 BPM; the range excludes its half and double
BAR_PHASE = 1               # index of the first grid beat that is a downbeat (0..3): the snares fall on 2 and 4 and the kicks on 1 and 3 (grid beat 0 is a pickup)
BEATS_BEFORE = 0            # grid beats before t = 0 (none: the grid starts on the song's first beat)

# Sections, cut on the lyric lines (data/lyrics.json, analysis/align.py): each named section starts on the 8th note
# at or before its first line's first word and runs to the next section's start; where a line's end and the next
# section's first line are more than 2 s apart, the gap is an instrumental "break" of its own, from the 8th note after
# the line's end. Until lyrics.json exists, the sections come from where the tracks play (SECTION_BARS, bar k starting
# at 0.99 + 2k s: the voice enters on bar 2, the kit alone marks bars 18-24 once a bar, bass and full drums from bar
# 24, everything but guitar and voice drops out for bars 55-62, the band returns at bar 62 and plays to the end).
SECTION_LINES = [
    ("verse1", 0), ("chorus1", 6), ("verse2", 10), ("chorus2", 16), ("verse3", 20), ("chorus3", 26), ("outro", 30),
]
SECTION_BARS = [
    ("intro", None, 2), ("verse1", 2, 18), ("build", 18, 24), ("band1", 24, 55), ("quiet", 55, 62), ("band2", 62, None),
]


def lyric_sections(duration, beat0, P):
    """The section list from the aligned lines, or None without data/lyrics.json."""
    f = common.DATA / "lyrics.json"
    if not f.exists():
        return None
    lines = json.loads(f.read_text(encoding="utf-8"))["lines"]
    eighth = P / 2
    before = lambda t: beat0 + eighth * math.floor((t - beat0) / eighth + 1e-6)
    after = lambda t: beat0 + eighth * math.ceil((t - beat0) / eighth - 1e-6)
    out = [dict(name="intro", start=0.0)]
    for k, (name, li) in enumerate(SECTION_LINES):
        start = before(lines[li]["start"])
        if k > 0:
            prev_end = lines[li - 1]["end"]
            if start - prev_end > 2.0:
                out.append(dict(name=f"break{k}", start=after(prev_end)))
        out.append(dict(name=name, start=start))
    for i, sct in enumerate(out):
        sct["end"] = out[i + 1]["start"] if i + 1 < len(out) else duration
        sct["start"], sct["end"] = round(sct["start"], 3), round(sct["end"], 3)
    return out


# ---------------------------------------------------------------------------
def band_sos(lo, hi, sr):
    if lo and hi:
        return butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    if hi:
        return butter(4, hi, btype="low", fs=sr, output="sos")
    return butter(4, lo, btype="high", fs=sr, output="sos")


def frame_rms(x, sr, fps=FPS, win=2048):
    hop = sr / fps
    n = int(math.ceil(len(x) / sr * fps))
    pad = np.pad(x, (win // 2, win // 2 + int(hop) + 2))
    idx = (np.arange(n) * hop).astype(int)
    c = np.concatenate([[0.0], np.cumsum(pad.astype(np.float64) ** 2)])
    e = (c[idx + win] - c[idx]) / win
    return np.sqrt(np.maximum(e, 0))


def smooth_env(x, fps=FPS, attack=0.010, release=0.090):
    """One-pole follower: fast attack, slower release (visual friendly)."""
    aa = math.exp(-1 / (attack * fps))
    ar = math.exp(-1 / (release * fps))
    y = np.empty_like(x)
    s = 0.0
    for i, v in enumerate(x):
        a = aa if v > s else ar
        s = a * s + (1 - a) * v
        y[i] = s
    return y


def norm01(x, pct=99.0):
    ref = np.percentile(x, pct)
    return np.clip(x / (ref + 1e-12), 0, 1)


# ---------------------------------------------------------------------------
def fit_grid(drums, mix, sr, duration):
    """Constant-tempo grid: coarse tempo/phase search on spectral-flux onset
    envelopes, then phase refinement on kick attack times."""
    hop = 64
    fps = sr / hop
    od = librosa.onset.onset_strength(y=librosa.resample(drums, orig_sr=sr, target_sr=22050),
                                      sr=22050, hop_length=hop // 2, lag=1, max_size=1)
    om = librosa.onset.onset_strength(y=librosa.resample(mix, orig_sr=sr, target_sr=22050),
                                      sr=22050, hop_length=hop // 2, lag=1, max_size=1)
    o = od / (np.percentile(od, 99) + 1e-9) + om / (np.percentile(om, 99) + 1e-9)
    ofps = 22050 / (hop // 2)

    def score(P, off):
        ts = off + P * np.arange(int(duration / P) + 1)
        idx = np.round(ts * ofps).astype(int)
        idx = idx[(idx > 2) & (idx < len(o) - 2)]
        return np.maximum.reduce([o[idx - 1], o[idx], o[idx + 1]]).mean()

    best = (0, None, None)
    for bpm in np.arange(*BPM_RANGE, 0.02):
        P = 60 / bpm
        for off in np.arange(0, P, 0.004):
            s = score(P, off)
            if s > best[0]:
                best = (s, bpm, off)
    _, bpm, off = best
    for b2 in np.arange(bpm - 0.02, bpm + 0.02, 0.001):  # fine
        P = 60 / b2
        for o2 in np.arange(off - 0.01, off + 0.01, 0.001):
            s = score(P, o2)
            if s > best[0]:
                best = (s, b2, o2)
    _, bpm, off = best
    P = 60 / bpm
    # refine phase on kick attacks (steepest rise of low-band log energy)
    kick_t, _ = band_onsets(drums, sr, None, 120, win=0.012, min_gap=0.2, rel_db=12)
    n = np.round((kick_t - off) / P)
    res = kick_t - (off + n * P)
    res = res[np.abs(res) < 0.06]
    off = off + float(np.median(res))
    # first beat >= 0
    off = off - P * math.floor(off / P)
    return bpm, P, off, res


def band_onsets(x, sr, lo, hi, win=0.010, hop_s=0.002, min_gap=0.08, rel_db=10.0,
                decay_win=None):
    """Onsets in a frequency band: steepest rise of the band's log-energy
    envelope; strength = peak dB rise.  Returns (times, rise_db[, decay_db])."""
    xb = sosfiltfilt(band_sos(lo, hi, sr), x)
    h = int(hop_s * sr)
    w = int(win * sr)
    e = np.convolve(xb.astype(np.float64) ** 2, np.ones(w) / w, mode="same")[::h]
    db = 10 * np.log10(e + 1e-10)
    fps = sr / h  # exact frame rate (h is an integer number of samples)
    d = np.diff(db, prepend=db[0])
    d = uniform_filter1d(d, 3)
    # rise over ~20 ms
    lag = int(0.02 * fps)
    rise = db - np.concatenate([np.full(lag, db[0]), db[:-lag]])
    floor = median_filter(db, int(1.0 * fps) | 1)
    pk, _ = find_peaks(rise, height=rel_db, distance=int(min_gap * fps))
    times, strength = [], []
    for p in pk:
        a = max(0, p - lag)
        # attack time: steepest slope within the rise window
        q = a + int(np.argmax(d[a:p + 1]))
        peak_db = db[p:p + int(0.03 * fps)].max()
        if peak_db < floor[p] + 3:
            continue
        times.append(q / fps)
        strength.append(peak_db)
    return np.array(times), np.array(strength)


def drum_onsets(kick, snare, kit, sr, grid_P, grid_off):
    """Kick / snare / hat onsets, each from its own track of the multitrack set."""
    # KICK: <120 Hz of the kick track
    kt, kdb = band_onsets(kick, sr, None, 120, win=0.012, min_gap=0.15, rel_db=12)
    d = snare
    # SNARE (and the clap-like snare of the quiet chorus): candidates are
    # 1.5-5 kHz attacks; a snare has a long noisy 0.5-5 kHz tail 40-120 ms after
    # the attack.  Keep candidates whose tail is within 8 dB of the loudest tail
    # in +-2.5 s and within 25 dB of the song-wide level (rejects stem bleed).
    # Kick-only beats / hats have tails 12-30 dB lower.
    st, sdb = band_onsets(d, sr, 1500, 5000, win=0.010, min_gap=0.15, rel_db=10)
    xb = sosfiltfilt(band_sos(500, 5000, sr), d)
    e = np.sqrt(np.convolve(xb.astype(np.float64) ** 2, np.ones(441) / 441, mode="same"))
    tail = np.array([20 * np.log10(e[int((t + 0.04) * sr):int((t + 0.12) * sr)].mean() + 1e-9) for t in st])
    rel = np.array([tail[i] - tail[np.abs(st - st[i]) < 2.5].max() for i in range(len(st))])
    thr = np.percentile(tail, 95) - 25
    keep = (rel > -8) & (tail > thr)
    st, sdb, stail = st[keep], sdb[keep], tail[keep]
    # HAT: >7 kHz of the kit track, short; drop those coinciding with snares (snare noise also
    # reaches 7k+)
    ht, hdb = band_onsets(kit, sr, 7000, None, win=0.006, min_gap=0.06, rel_db=9)
    # (and those within 30 ms of a kick: the kick's beater click reaches 10 kHz)
    for other, gap in ((st, 0.04), (kt, 0.03)):
        if len(other) and len(ht):
            dist = np.min(np.abs(ht[:, None] - other[None, :]), axis=1)
            keep = dist > gap
            ht, hdb = ht[keep], hdb[keep]
    return (kt, kdb), (st, stail), (ht, hdb), thr


def strength01(db_vals, lo_pct=5, hi_pct=95):
    if len(db_vals) == 0:
        return db_vals
    lo, hi = np.percentile(db_vals, lo_pct), np.percentile(db_vals, hi_pct)
    return np.clip((db_vals - lo) / (hi - lo + 1e-9) * 0.8 + 0.2, 0, 1)


def vocal_onsets(v, sr):
    """Vocal note onsets: onset-strength peaks of the vocal stem, where the voice is active."""
    hop = 256
    on = librosa.onset.onset_strength(y=v, sr=sr, hop_length=hop, lag=2, max_size=3)
    rms = librosa.feature.rms(y=v, hop_length=hop)[0]
    db = 20 * np.log10(rms + 1e-9)
    active = db > np.percentile(db, 95) - 30
    pk = librosa.onset.onset_detect(onset_envelope=on, sr=sr, hop_length=hop, backtrack=False,
                                    pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=0.12, wait=8)
    pk = [p for p in pk if active[min(len(active) - 1, p + 2)]]
    s = on[pk] / (np.percentile(on[pk], 95) + 1e-9) if pk else []
    return [(float(p * hop / sr), float(min(1.0, max(0.1, x)))) for p, x in zip(pk, s)]


# ---------------------------------------------------------------------------
def main(plots=False):
    mix, _ = common.load_mix(SR)
    duration = len(mix) / SR
    # the clean multitracks stand in for the Demucs stems: drums = kick + snare + kit, bass = rhythm, other = guitar + backing
    tr = {n: common.load_track(n, sr=SR)[0][: len(mix)] for n in ("drums_1", "drums_2", "drums_3", "guitar", "rhythm", "vocals", "song")}
    stems = {"vocals": tr["vocals"], "drums": tr["drums_1"] + tr["drums_2"] + tr["drums_3"], "bass": tr["rhythm"],
             "other": tr["guitar"] + tr["song"], "kick": tr["drums_1"], "snare": tr["drums_2"], "kit": tr["drums_3"]}
    for n in stems:
        if len(stems[n]) < len(mix):
            stems[n] = np.pad(stems[n], (0, len(mix) - len(stems[n])))

    bpm, P, off, kick_res = fit_grid(stems["drums"], mix, SR, duration)
    print(f"tempo {bpm:.3f} BPM  period {P:.5f}s  first beat {off:.4f}s  kick residual sd {kick_res.std()*1000:.1f} ms")
    beats = off + P * np.arange(-BEATS_BEFORE, int((duration - off) / P) + 1)
    print(f"grid starts at {beats[0]:.3f} s")
    # bar phase: grid beat 0 is a downbeat (see NOTES / qa/drums_pattern.png)
    beat_in_bar = (np.arange(len(beats)) - BAR_PHASE) % 4
    downbeats = beats[beat_in_bar == 0]
    bar_t = lambda k: float(downbeats[0] + 4 * P * k)

    # envelopes -------------------------------------------------------------
    n = int(math.ceil(duration * FPS))
    env = {}
    env["rms"] = frame_rms(mix, SR)[:n]
    for name, (lo, hi) in {"low": (None, 150), "mid": (150, 2000), "high": (4000, None)}.items():
        env[name] = frame_rms(sosfiltfilt(band_sos(lo, hi, SR), mix), SR)[:n]
    for s in ("vocal", "drums", "bass", "other"):
        env[s] = frame_rms(stems["vocals" if s == "vocal" else s], SR)[:n]
    for k in env:
        e = smooth_env(env[k])
        env[k] = [round(float(x), 3) for x in norm01(e)]
        assert len(env[k]) == n

    # onsets -------------------------------------------------------------------
    (kt, kdb), (st, sdb), (ht, hdb), sn_thr = drum_onsets(stems["kick"], stems["snare"], stems["kit"], SR, P, off)
    onsets = {
        "kick": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(kt, strength01(kdb))],
        "snare": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(st, strength01(sdb))],
        "hat": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(ht, strength01(hdb))],
        "vocal": [[round(t, 3), round(s, 3)] for t, s in vocal_onsets(stems["vocals"], SR)],
    }
    # snare / kick position statistics -> bar phase evidence
    def pos_hist(ts):
        ph = np.round((np.asarray(ts) - downbeats[0]) / (P / 2)).astype(int) % 8
        return np.bincount(ph, minlength=8).tolist()
    print("kick   8th-positions in bar:", pos_hist(kt))
    print("snare  8th-positions in bar:", pos_hist(st))
    print("hat    8th-positions in bar:", pos_hist(ht))

    # sections -------------------------------------------------------------------
    sections = lyric_sections(duration, beats[0], P)
    if sections is None:
        sections = []
        for name, a, b in SECTION_BARS:
            s = 0.0 if a is None else bar_t(a)
            e = duration if b is None else bar_t(b)
            sections.append(dict(name=name, start=round(s, 3), end=round(e, 3)))
    for sct in sections:
        print(f"section {sct['name']:8s} {sct['start']:8.3f} - {sct['end']:8.3f}  bar {(sct['start'] - downbeats[0]) / (4 * P):6.2f}")

    doc = dict(
        duration=round(duration, 3),
        bpm=round(bpm, 3),
        beat_period=round(P, 5),
        time_signature=4,
        beats=[round(float(t), 3) for t in beats],
        downbeats=[round(float(t), 3) for t in downbeats],
        sections=sections,
        fps=FPS,
        **env,
        onsets=onsets,
        notes=NOTES.format(bpm=bpm, off=off, P=P, first_db=float(downbeats[0]),
                           sn=len(st), kk=len(kt), hh=len(ht)),
    )
    (common.DATA / "audio.json").write_text(json.dumps(doc, separators=(",", ":")))
    print("wrote", common.DATA / "audio.json", f"{len(beats)} beats, {len(downbeats)} downbeats, "
          f"{len(kt)} kicks, {len(st)} snares, {len(ht)} hats, {len(onsets['vocal'])} vocal onsets")
    if plots:
        make_plots(doc, stems)
    return doc


NOTES = (
    "Timeline = audio/mix.wav (the song: the mixdown of the seven supplied tracks). "
    "Tempo is constant: {bpm:.3f} BPM (period {P:.5f} s), fitted over the whole cut on "
    "drum+mix onset envelopes, phase refined on kick attack times; first beat in the song {off:.3f} s. "
    "The grid starts on the song's first beat (a pickup); bar 0 starts on the next beat. "
    "First downbeat {first_db:.3f} s; bar k starts at first_downbeat + k*4*period. "
    "Envelopes: 100 fps, frame i centred at i/100 s, 46 ms RMS window, one-pole smoothing "
    "(10 ms attack / 90 ms release), each divided by its own 99th percentile and clipped "
    "to 0..1 (linear amplitude). low <150 Hz, mid 150-2000 Hz, high >4 kHz of the full mix; "
    "vocal/drums/bass/other = RMS of the supplied tracks (drums = kick+snare+kit, bass = rhythm, other = guitar+backing). "
    "Onsets [time, strength 0-1] from the tracks: kick = <120 Hz attacks of the kick track ({kk}); snare = 1.5-5 kHz "
    "attacks of the snare track with a loud noise tail ({sn}); hat = >7 kHz attacks of the kit track away from snares and kicks ({hh}). "
    "vocal = onset-strength peaks of the vocal stem."
)


def make_plots(doc, stems):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    wins = [(0, 12), (34, 46), (48, 60), (100, 114), (122, 134)]
    t = np.arange(len(doc["rms"])) / FPS
    for (t0, t1) in wins:
        fig, ax = plt.subplots(3, 1, figsize=(22, 11), sharex=True,
                               gridspec_kw=dict(height_ratios=[2, 1.6, 1.4]))
        d = stems["drums"][int(t0 * SR):int(t1 * SR)]
        S = librosa.amplitude_to_db(np.abs(librosa.stft(d, n_fft=1024, hop_length=128)), ref=np.max)
        ax[0].imshow(S, origin="lower", aspect="auto", cmap="magma", vmin=-60, vmax=0,
                     extent=[t0, t0 + S.shape[1] * 128 / SR, 0, SR / 2])
        ax[0].set_ylim(0, 12000)
        ax[0].set_ylabel("drums stem")
        m = (t >= t0) & (t <= t1)
        for k, c in [("rms", "k"), ("low", "tab:red"), ("mid", "tab:green"), ("high", "tab:blue")]:
            ax[1].plot(t[m], np.array(doc[k])[m], color=c, lw=1, label=k)
        ax[1].legend(loc="upper left", fontsize=8)
        for k, c in [("vocal", "tab:purple"), ("drums", "tab:orange"), ("bass", "tab:brown"), ("other", "tab:olive")]:
            ax[2].plot(t[m], np.array(doc[k])[m], color=c, lw=1, label=k)
        ax[2].legend(loc="upper left", fontsize=8)
        for b in doc["beats"]:
            if t0 <= b <= t1:
                for a_ in ax:
                    a_.axvline(b, color="gray", lw=0.6, alpha=0.6)
        for b in doc["downbeats"]:
            if t0 <= b <= t1:
                for a_ in ax:
                    a_.axvline(b, color="c" if a_ is ax[0] else "k", lw=1.8)
        for name, y, c in [("kick", 1500, "tab:red"), ("snare", 5000, "w"), ("hat", 9500, "yellow")]:
            for (ot, s) in doc["onsets"][name]:
                if t0 <= ot <= t1:
                    ax[0].plot([ot], [y], marker="v", color=c, ms=4 + 8 * s)
        for (ot, s) in doc["onsets"]["vocal"]:
            if t0 <= ot <= t1:
                ax[2].plot([ot], [1.02], marker="v", color="tab:purple", ms=3 + 6 * s)
        for s in doc["sections"]:
            if t0 <= s["start"] <= t1:
                ax[1].text(s["start"], 1.02, s["name"], fontsize=14, color="tab:red")
                for a_ in ax:
                    a_.axvline(s["start"], color="tab:red", lw=2.5)
        ax[2].set_xlim(t0, t1)
        ax[2].set_xticks(np.arange(np.ceil(t0), t1, 0.5))
        fig.tight_layout()
        fig.savefig(common.QA / f"audio_{int(t0):03d}.png", dpi=65)
        plt.close(fig)
    # overview
    fig, ax = plt.subplots(2, 1, figsize=(24, 7), sharex=True)
    for k, c in [("rms", "k"), ("low", "tab:red"), ("high", "tab:blue")]:
        ax[0].plot(t, doc[k], color=c, lw=0.6, label=k)
    for k, c in [("vocal", "tab:purple"), ("drums", "tab:orange"), ("bass", "tab:brown"), ("other", "tab:olive")]:
        ax[1].plot(t, doc[k], color=c, lw=0.6, label=k)
    for s in doc["sections"]:
        for a_ in ax:
            a_.axvline(s["start"], color="tab:red", lw=1.5)
        ax[0].text(s["start"] + 0.2, 1.03, s["name"], fontsize=10, color="tab:red")
    for a_ in ax:
        a_.legend(loc="upper right", fontsize=8)
    ax[1].set_xticks(np.arange(0, doc['duration'], 5))
    fig.tight_layout()
    fig.savefig(common.QA / "audio_overview.png", dpi=65)
    plt.close(fig)


if __name__ == "__main__":
    main(plots="--plots" in sys.argv)
