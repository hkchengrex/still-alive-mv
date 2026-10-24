"""Word-level lyric alignment -> data/lyrics.json

The lyrics come from lyrics/full.txt (one sung line per line, blank lines ignored; the text as the
rights holder publishes it). Each line's words are forced-aligned to the clean
vocal track with torchaudio's MMS_FA (CTC Viterbi over the letters of the words), one pass per block
of lines inside a window of the song that holds only those lines (REGIONS), so that a quiet line
cannot wander into an instrumental.

Output per line: text, start, end, words[]; per word: w (as written, punctuation kept), start, end,
conf (mean posterior of its letters), syl (one [start, end] per letter, for wipes). The script prints
the alignment and lists the words under 0.3 confidence to check by ear.

Run:  uv run python align.py
"""
import common
import json
import re
import sys

import numpy as np
import soundfile as sf
import soxr
import torch
import torchaudio

LYRICS = common.PROJECT / "lyrics" / "full.txt"
VOCALS = common.PROJECT / "audio" / "vocals.wav"   # the clean vocal track of the multitrack set
SR = 16000
HOP = 320                # wav2vec2 frame = 20 ms
TAIL_DB = -24.0          # a line's last word is held while the vocal stays within this of the line's peak
TAIL_MAX = 1.2
# Blocks of lines (half-open ranges) and the song seconds each is searched in. Set after a first pass over the whole
# song shows where the lines fall; None aligns everything in one pass.
REGIONS = None


def letters(word):
    """The aligner's tokens for a word: lowercase a-z and the apostrophe dropped (MMS_FA has no ')."""
    w = word.lower().replace("’", "'")
    w = re.sub(r"[^a-z']", "", w).replace("'", "")
    return w


def emissions(model, wav):
    """Log-probs (T x V), computed in 20 s windows with 2 s of context either side."""
    win, ctx = 20 * SR, 2 * SR
    out = []
    for s in range(0, len(wav), win):
        a, b = max(0, s - ctx), min(len(wav), s + win + ctx)
        x = wav[a:b]
        with torch.inference_mode():
            lp = torch.log_softmax(model(torch.from_numpy(x)[None].cuda())[0][0].float(), -1).cpu().numpy()
        f0 = (s - a) // HOP
        n = (min(s + win, len(wav)) - s) // HOP
        out.append(lp[f0:f0 + n])
    return np.concatenate(out)


def ctc_viterbi(lp, tgt, blank):
    """Best CTC path of the target sequence; returns (frame, target index) for frames that emit a target."""
    T, L = len(lp), len(tgt)
    S = 2 * L + 1
    lab = np.full(S, blank)
    lab[1::2] = tgt
    skip = np.zeros(S, bool)
    skip[3::2] = np.array(tgt[1:]) != np.array(tgt[:-1])
    NEG = -1e30
    dp = np.full(S, NEG)
    dp[0], dp[1] = lp[0, blank], lp[0, tgt[0]]
    back = np.zeros((T, S), np.int8)
    for t in range(1, T):
        c0 = dp
        c1 = np.concatenate([[NEG], dp[:-1]])
        c2 = np.where(skip, np.concatenate([[NEG, NEG], dp[:-2]]), NEG)
        stack = np.stack([c0, c1, c2])
        k = np.argmax(stack, 0)
        dp = stack[k, np.arange(S)] + lp[t, lab]
        back[t] = k
    s = S - 1 if dp[S - 1] >= dp[S - 2] else S - 2
    path = []
    for t in range(T - 1, -1, -1):
        if s % 2 == 1:
            path.append((t, s // 2))
        s -= int(back[t, s])
    return path[::-1]


def main():
    lines = [l.strip() for l in LYRICS.read_text(encoding="utf-8").splitlines() if l.strip()]
    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model(with_star=False).cuda().eval()
    vocab = bundle.get_dict(star=None)
    blank = vocab["-"]

    units = []   # dict(line, word, ids)
    for li, line in enumerate(lines):
        for wi, tok in enumerate(line.split()):
            ids = [vocab[c] for c in letters(tok) if c in vocab]
            if not ids:
                raise SystemExit(f"line {li}: no letters in {tok!r}")
            units.append(dict(line=li, word=wi, ids=ids))

    y, s = sf.read(VOCALS, dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    wav = soxr.resample(y, s, SR).astype(np.float32) if s != SR else y
    lp = emissions(model, wav)
    # vocal level per frame (for holding a line's last word)
    e = np.array([np.sqrt(np.mean(wav[i * HOP:(i + 1) * HOP] ** 2)) for i in range(len(lp))])
    edb = 20 * np.log10(e + 1e-6)

    regions = REGIONS or [((0, len(lines)), (0.0, len(wav) / SR))]
    spans = {}   # unit index -> (frame0, frame1, mean posterior)
    for (l0, l1), (ra, rb) in regions:
        us = [i for i, u in enumerate(units) if l0 <= u["line"] < l1]
        f0, f1 = int(ra * SR / HOP), min(len(lp), int(rb * SR / HOP))
        tgt = [c for i in us for c in units[i]["ids"]]
        owner = [i for i in us for _ in units[i]["ids"]]
        path = ctc_viterbi(lp[f0:f1], tgt, blank)
        post = {}
        for fr, ti in path:
            u = owner[ti]
            a, b, ps = spans.get(u, (fr, fr, []))
            post.setdefault(u, []).append(float(np.exp(lp[f0 + fr, tgt[ti]])))
            spans[u] = (min(a, fr), max(b, fr), None)
        for u in us:
            a, b, _ = spans[u]
            spans[u] = (f0 + a, f0 + b, float(np.mean(post[u])))
    # per-letter spans: letters of a word split its frames evenly by the path's emission frames
    out_lines = []
    ui = 0
    for li, line in enumerate(lines):
        toks = line.split()
        words = []
        for wi, tok in enumerate(toks):
            a, b, conf = spans[ui]
            nxt = spans[ui + 1][0] if ui + 1 < len(units) else b + 1
            # a word lasts until the next word starts (capped), the line's last word while the voice holds
            end = min(nxt, b + 1 + int(0.35 * SR / HOP))
            if wi == len(toks) - 1:
                peak = edb[a:b + 2].max()
                k = b + 1
                while k < min(len(edb), b + 1 + int(TAIL_MAX * SR / HOP)) and edb[k] > peak + TAIL_DB and k < nxt:
                    k += 1
                end = max(end, k)
            n = max(1, len(letters(tok)))
            fr = np.linspace(a, end, n + 1)
            syl = [[round(float(fr[i] * HOP / SR), 3), round(float(fr[i + 1] * HOP / SR), 3)] for i in range(n)]
            words.append(dict(w=tok, start=round(a * HOP / SR, 3), end=round(end * HOP / SR, 3), conf=round(conf, 3), syl=syl))
            ui += 1
        out_lines.append(dict(text=line, start=words[0]["start"], end=words[-1]["end"], words=words))
    doc = dict(lines=out_lines, notes="Timeline = audio/mix.wav. Words forced-aligned to audio/vocals.wav (the clean vocal track) "
               "with torchaudio MMS_FA (CTC Viterbi over the letters of the words); a word lasts until the next word starts, "
               "at most 0.35 s after its last letter; a line's last word is held while the voice stays within 24 dB of the "
               "line's peak, at most 1.2 s. conf = mean posterior of the word's letters. syl = the word's letters, evenly spaced.")
    (common.DATA / "lyrics.json").write_text(json.dumps(doc, ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")
    low = []
    for l in out_lines:
        print(f"{l['start']:7.2f}-{l['end']:7.2f}  {l['text']}")
        print("        " + "  ".join(f"{w['w']}@{w['start']:.2f}({w['conf']:.2f})" for w in l["words"]))
        low += [(w["start"], w["w"], w["conf"]) for w in l["words"] if w["conf"] < 0.3]
    print(f"wrote {common.DATA / 'lyrics.json'}: {len(out_lines)} lines, {sum(len(l['words']) for l in out_lines)} words")
    if low:
        print("low-confidence words to check by ear:")
        for t, w, c in low:
            print(f"  {t:7.2f}  {w}  {c:.2f}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
