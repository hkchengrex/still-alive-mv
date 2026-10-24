# The pipeline: from the recording to the data

The renderer runs on three inputs: the song (`audio/mix.wav`), its analysis (`data/audio.json`) and the aligned lyrics (`data/lyrics.json`). The song is not in the repository. The two data files are included (they are what the scripts below produced), as is the lyric text, so the analysis only has to be rerun to change them. The font is the renderer's other input, fetched by one more script.

## Inputs

`audio/` holds a multitrack set of the song and its mixdown. **The song is `audio/mix.wav`** (179.199 s, 44.1 kHz, 24-bit): it is exactly 0.454 times the sum of the seven tracks, so everything is on one timeline with no offset. The tracks:

| file | what it is |
|---|---|
| `drums_1.wav` | kick (96 % of its energy under 200 Hz) |
| `drums_2.wav` | snare |
| `drums_3.wav` | kit: cymbals, toms, hats |
| `guitar.wav` | the plucked guitar, playing from the first bar |
| `rhythm.wav` | bass (90 % under 200 Hz; enters at bar 24) |
| `vocals.wav` | the clean lead vocal |
| `song.wav` | the backing: keys and pads; silent until 36 s |

The player and the exporter use `mix.wav`. These files belong to their rights holders and stay out of the repository (`.gitignore`).

## Environment

`analysis/pyproject.toml` and `uv.lock` pin the tools (Python 3.11–3.12, PyTorch with CUDA 12.8, librosa, torchaudio, WhisperX, soundfile, soxr). `common.py` is imported first by every script: it sets every model cache under `analysis/.cache/` and defines the paths.

```powershell
cd analysis
uv sync
uv run python analyze.py --plots
uv run python align.py
```

## 1. The music: `analyze.py` → `data/audio.json`

- **The grid.** A constant tempo and phase fitted on the drum and mix onset envelopes, the phase refined on the kick track's attacks: **119.995 BPM** (a beat is 0.50002 s, a bar 2.000 s), first beat at **0.489 s**, kick residual 2.9 ms. Grid beat 0 is a pickup; **bar 0 starts on the next beat, 0.989 s**, and bar k at 0.989 + 2k s. Snares fall on beats 2 and 4, kicks on 1 and 3 (and the and of 4), which fixes the bar phase. `beats` has 358 entries, `downbeats` 90.
- **Envelopes** at 100 fps (17,920 values each), each normalised to its 99th percentile: `rms`, `low` (< 150 Hz), `mid`, `high` (> 4 kHz) of the mix; `vocal`, `drums` (kick + snare + kit), `bass` (rhythm) and `other` (guitar + backing) from the tracks.
- **Onsets** with a strength 0–1: `kick` from the kick track (320), `snare` from the snare track (108), `hat` from the kit track (288), `vocal` note onsets from the vocal track (265). The first verse has no drums: the kicks begin at 36 s and the snares at 50 s, and anything that follows the music there follows the guitar and the voice.
- **Sections** are cut on the aligned lyric lines: each starts on the 8th note at or before its first line's first word; an instrumental gap of more than 2 s between a line's end and the next section is a `break` of its own.

| section | from | to | bars | lines |
|---|---|---|---|---|
| `intro` | 0:00.00 | 0:04.74 | −0.49–1.87 | none |
| `verse1` | 0:04.74 | 0:35.49 | 1.87–17.25 | L0–L5 |
| `chorus1` | 0:35.49 | 0:50.99 | 17.25–25.00 | L6–L9 |
| `break2` | 0:50.99 | 0:56.74 | 25.00–27.87 | none |
| `verse2` | 0:56.74 | 1:27.24 | 27.87–43.12 | L10–L15 |
| `chorus2` | 1:27.24 | 1:43.24 | 43.12–51.12 | L16–L19 |
| `break4` | 1:43.24 | 1:48.74 | 51.12–53.87 | none |
| `verse3` | 1:48.74 | 2:19.24 | 53.87–69.12 | L20–L25 |
| `chorus3` | 2:19.24 | 2:35.50 | 69.12–77.25 | L26–L29 |
| `outro` | 2:35.50 | 2:59.20 | 77.25–89.10 | L30–L36 |

- `--plots` writes `analysis/qa/audio_*.png`: the drum spectrogram with the grid and the onsets over it, and the envelopes, for five windows and the whole song.

## 2. The lyrics: `align.py` → `data/lyrics.json`

Needs `lyrics/full.txt`: the song's text as published, one sung line per line (37 lines). Each line's words are forced-aligned to `audio/vocals.wav` with torchaudio's MMS_FA (a CTC Viterbi pass over the letters of the words), in blocks inside windows of the song (`REGIONS`) where a first pass shows where the lines fall. Per word: `w` as written, `start`, `end`, `conf` (the mean posterior of its letters; the ones under 0.3 are listed to check by ear) and `syl` (one span per letter). Per line: `text`, `start`, `end`, `words`. A line's end holds while the voice holds, at most 1.2 s after its last word. The result has 37 lines and 278 words; `qa_lyrics.py` draws every word's start on the vocal track's spectrogram (`analysis/qa/lyrics_*.png`).

The aligned word starts sit within about 20 ms of the vocal onsets the analysis finds (median −24 ms over the 234 words that have one within 0.3 s).

## The measured map

Bar k starts at 0.989 + 2k s. A line's start is its first word's. Lines are numbered from 0 in the order of `lyrics/full.txt`.

| line | start | end | bar | words |
|---|---|---|---|---|
| L0 | 0:04.94 | 0:06.76 | 1.98 | 4 |
| L1 | 0:08.86 | 0:12.56 | 3.94 | 7 |
| L2 | 0:13.82 | 0:18.94 | 6.42 | 6 |
| L3 | 0:21.04 | 0:22.76 | 10.03 | 2 |
| L4 | 0:24.74 | 0:28.48 | 11.88 | 8 |
| L5 | 0:29.96 | 0:35.36 | 14.48 | 13 |
| L6 | 0:35.50 | 0:39.54 | 17.25 | 8 |
| L7 | 0:39.54 | 0:43.58 | 19.27 | 11 |
| L8 | 0:43.58 | 0:47.48 | 21.29 | 11 |
| L9 | 0:47.48 | 0:50.92 | 23.24 | 7 |
| L10 | 0:56.84 | 0:58.60 | 27.92 | 4 |
| L11 | 1:01.14 | 1:04.50 | 30.07 | 6 |
| L12 | 1:06.02 | 1:10.88 | 32.51 | 9 |
| L13 | 1:12.80 | 1:14.68 | 35.90 | 5 |
| L14 | 1:16.80 | 1:20.52 | 37.90 | 7 |
| L15 | 1:22.08 | 1:27.26 | 40.54 | 12 |
| L16 | 1:27.46 | 1:31.58 | 43.23 | 9 |
| L17 | 1:31.58 | 1:35.46 | 45.29 | 9 |
| L18 | 1:35.46 | 1:39.52 | 47.23 | 13 |
| L19 | 1:39.52 | 1:43.12 | 49.26 | 7 |
| L20 | 1:48.96 | 1:51.00 | 53.98 | 5 |
| L21 | 1:52.86 | 1:56.62 | 55.93 | 7 |
| L22 | 1:58.02 | 2:02.78 | 58.51 | 8 |
| L23 | 2:05.02 | 2:06.76 | 62.01 | 3 |
| L24 | 2:08.98 | 2:12.72 | 63.99 | 7 |
| L25 | 2:14.06 | 2:19.46 | 66.53 | 10 |
| L26 | 2:19.48 | 2:23.50 | 69.24 | 10 |
| L27 | 2:23.52 | 2:27.62 | 71.26 | 12 |
| L28 | 2:27.62 | 2:31.62 | 73.31 | 10 |
| L29 | 2:31.62 | 2:35.06 | 75.31 | 7 |
| L30 | 2:35.56 | 2:38.62 | 77.28 | 7 |
| L31 | 2:39.38 | 2:42.60 | 79.19 | 7 |
| L32 | 2:43.36 | 2:46.62 | 81.18 | 7 |
| L33 | 2:47.46 | 2:50.64 | 83.23 | 7 |
| L34 | 2:51.30 | 2:54.60 | 85.15 | 9 |
| L35 | 2:55.16 | 2:56.58 | 87.08 | 2 |
| L36 | 2:57.18 | 2:58.28 | 88.09 | 2 |

## 3. The font: `app/public/fonts/fetch.py`

`python app/public/fonts/fetch.py`. It downloads IBM Plex Mono (Light, Regular, Medium, SemiBold, Bold and Italic) and its licence from the google/fonts repository at one pinned commit, checks each file's SHA-256 against the file the video was rendered with, and saves them in `app/public/fonts/src/`. The renderer sets the grid in Medium and rasterises the block letters from Bold. The single-stroke SVG fonts in `app/public/fonts/stroke/` are in the repository; the engine loads them, the scenes do not use them.

## 4. The video

See `ENGINE.md` (Running things). The final is one run of the export at 60 fps and `--scale 2`: 10,752 frames of 3840 × 2160 with the song muxed (AAC 320k), about 72 minutes on a laptop with an RTX 5070. A review pass at 1080p30 takes about ten.
