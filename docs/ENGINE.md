# The renderer

`app/` is a web app (TypeScript, three.js, run with bun and Vite) that renders any song time `t` deterministically at 1920 × 1080, or at 2× that. The same code drives the live preview in a browser and the offline 60 fps export through headless Chrome and ffmpeg. It is forked from mexicat/pdoom-video; for this video every scene paints a character grid on a Canvas2D layer, which the compositor uploads as a texture, and post-processing is off.

## Running things

All commands run from `app/`. Needs bun, Google Chrome, ffmpeg and ffprobe.

- **Install:** `bun install`.
- **Preview:** `bun x vite`, then open the address it prints. Space plays and pauses, the timeline seeks, `[` and `]` go to the previous and next scene, `l` loops the current scene. The status line shows the time, beat, bar, scene and the line being sung. Saving a scene file hot-reloads it.
- **Stills:** `bun scripts/render.ts stills --t 45.2,161.6 --out ../out/stills` (PNGs; `--only id1,id2` loads only those scenes).
- **Contact sheet:** `bun scripts/render.ts sheet --times 0.6,4.9,9.0,12.5 --cols 4 --out ../out/sheet.png` (or `--from a --to b --n 12`; `--cuts` gives four frames round every cut in the range).
- **Clip:** `bun scripts/render.ts video --from 159.0 --to 163.5 --fps 30 --samples 1 --preset fast --crf 20 --out ../out/clip.mp4` (H.264, with the song unless `--noaudio`).
- **The whole song, review quality:** `bun scripts/render.ts video --from 0 --to 179.199 --fps 30 --samples 1 --preset fast --crf 20 --out ../out/review.mp4` (about ten minutes).
- **The whole song, final:** `bun scripts/render.ts video --from 0 --to 179.199 --fps 60 --samples 1 --crf 18 --out ../out/still-alive.mp4`; add `--scale 2` for a true 3840 × 2160 (about 2.5 frames a second, 72 minutes).
- **The cover:** `bun scripts/render.ts stills --t 1 --only cover --scale 2 --out ../out/cover`. `--only cover` makes the whole song one cover scene.
- **Scene times:** `bun scripts/render.ts timeline` prints every scene's id, start and end.
- **Checks:** `bun scripts/render.ts check` renders three frames of every scene and verifies deterministic seeking; `bun scripts/render.ts gpu` prints the GPU Chrome is using; `bun scripts/render.ts perf --from 20 --to 25` prints the average ms per frame.
- **Typecheck:** `bun x tsc --noEmit -p .` (and `-p tsconfig.scripts.json` for the export script).
- **One sample per frame.** The motion is characters changing; motion blur would only smear the type, so every render uses `--samples 1`.
- A render uses the preview server at `--url` if one is running (default `http://localhost:5173`) and otherwise starts its own on a random port without live reload. Vite keeps a module's transform in its graph by path: after deleting a scene file and creating a new one at the same path, restart the dev server. Do not run stills or sheets while a video render is using the GPU.
- **Changing one scene in a finished export.** A scene's window is a whole number of frames, and the renderer's frame times are `from + i / fps`, so the window alone can be rendered (`--from` and `--to` on frame boundaries, `--noaudio`, the same `--fps` and `--scale`) and spliced in with ffmpeg's `trim` and `concat` filters in one encode, the audio copied from the original. Minutes instead of the hour; one extra encode generation on the rest.
- Windows: if bun is not on the PATH, prepend `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64`, and write `bun x …` for `bunx …`.

## Structure

| Path | What it is |
|---|---|
| `src/main.ts` | The entry: the preview player, or the export API (`?export=1`: `window.__mv` with `still(t)`, `png()`, `stream({from, to, fps, ws, samples, shutter})`, the timeline). |
| `src/timeline.ts` | The edit: the scene windows and their cues computed from `data/audio.json` and `data/lyrics.json`; no scene hard-codes a song time. `?only=cover` replaces it with the cover scene. |
| `src/engine/` | Inherited from the fork: scene loading, compositing and temporal sampling (`engine.ts`), Canvas2D layers and the compositor (`gl.ts`), fonts (`type.ts`), the lyric and audio data (`lyrics.ts`, `audio.ts`), post-processing (`post.ts`, off here), a HUD overlay (`hud.ts`, off), single-stroke fonts (`stroke.ts`, unused by the scenes). |
| `src/term/grid.ts` | The grid: 176 × 50 cells, the palette `P`, text, box-drawing lines that merge at junctions, block characters, a braille-dot overlay with Bresenham lines and circles, big text at a multiple of the cell, a rect overlay for maps denser than the grid, `held(t, period)` for readouts, deterministic hashes and easings. Box and block characters are drawn as rectangles, so they meet exactly. |
| `src/term/layout.ts` | Panes: a tiling tree of splits (by ratio or a fixed size) laid out on the grid with shared borders and titles; `mosaic` and `strip` for even tilings; an animated ratio slides a pane open or shut. |
| `src/term/widgets.ts` | What panes show: scrolling logs, a prompt, bars, tables, a test run, a git graph, the scaling-law plot and a line plot in braille, fire, a process table, core bars, a diff view, a pipeline, the optic, the Aperture mark, music-driven loads, a GPU table, a memory map, a disk map, a network pane, a logic analyser, a network map, a flame graph, the facility's connectivity graph, the gel plant, a wall of vitals. |
| `src/term/wire.ts` | A wireframe engine: models from lathes, rings, boxes and polylines, turned and projected onto the braille grid; the portal device, a test chamber, cubes (storage and companion), the chassis, a turret, a wall of panels, the lift shaft and car; `bounce` gives a dropped body's height over time. |
| `src/term/words.ts` | The text the machine says to itself: kernel log lines, syscalls, files, test names, jobs, hosts, commit messages. |
| `src/term/_term.ts` | The scene base: `frame(f)` returns the pane tree for the moment; the kit adds the `0:glados` lyric pane under it (each word typed across its lead) and the status bar, and paints the grid. |
| `src/scenes/` | The scenes: `boot`, `monitor`, `banner`, `jobs`, `retry`, `mosaic` (three modes), `calm`, `incident`, `fire`, `release`, `hosts`, `leave`, `helpers`, `ping`, `upgrade`, `camera`, `experiments`, `alive` (two modes), `reactor`, `dying`, `end`; and `cover`, outside the song. |
| `scripts/render.ts` | The export: drives the page in headless Chrome and streams frames to ffmpeg over a WebSocket. |
| `public/fonts/` | IBM Plex Mono (`fetch.py` gets it); the SVG stroke fonts the engine loads are included. |

## Data

The engine loads `data/audio.json` and `data/lyrics.json` (served from the folder root by Vite) and hands them to every scene as `this.ctx.audio` and `this.ctx.lyrics`.

- **Lyrics** (`lyrics.ts`): `lines[]` with `text, start, end, words[]`; a word has `w, start, end, conf, syl`. Queries: `lineAt(t)`, `lastLine(t)`, `nextLine(t)`, `wordAt(t)`, `find(s)`, `Lyrics.wordProgress(word, t)`, `Lyrics.lineCharProgress(line, t)`.
- **Audio** (`audio.ts`): `beats[]`, `downbeats[]`, `sections[]`, `beatAt(t)`, `barAt(t)`, `events('kick' | 'snare' | 'hat' | 'vocal', t0, t1)` as `[time, strength]`, `env(name, t)` for `rms | low | mid | high | vocal | drums | bass | other` (0..1), `hit(kind, t, halfLife)` decaying pulses, `sample(t)`.
- **Every `Frame`** carries `t`, `dt`, `lt` and `p` (local time and progress in the scene), `start`, `end`, `beat, bar, beatPhase, barPhase`, and `a` = `{rms, low, mid, high, vocal, drums, bass, other, kick, snare, hat, vonset}`.

## Writing a scene

One file `src/scenes/<id>.ts`, default-exporting a class that extends `Term` (`_term.ts`) and implements `frame(f)`: it returns the tree of panes for song time `f.t`. A `Pane` has a title, a border colour and a `draw(g, r)` that writes into its inner rect, with the grid clipped to it; a `split` has a direction and a ratio, which may be a function of time through the easings in `grid.ts`, so a pane slides open or shut. Scenes move on their cues (`this.cue('word')`, song seconds the timeline computed from the lyric data) and on the grid (`this.beatsIn`, `this.beatP`, `this.bar`).

Rules the scenes follow:

- **Deterministic.** The output is a pure function of `f.t`: no state advanced per frame, no unseeded randomness (`hash(i, j, k)`), no system clock. The export renders frames out of order and in separate runs.
- **Content that scrolls** is a list of `LogLine`s with the times they appear; `logPane` shows the ones that exist at `t`, bottom-aligned.
- **Readouts** sample `held(t, period)`; bars and plots use `t`.
- **Loads** come from `musicLoad(f.a, i, t, base, gain)`: the drums and the hits where there are drums, the plucked guitar's envelope and the voice where there are not.
- Cells are written with `g.set`, `g.text`, `g.box`, `g.hline`, `g.vline`; dots with `g.dot`, `g.dline`, `g.dcircle`; big type with `g.bigText`; dense maps with `g.cellRect`. The pane's inner rect `r` is in cells; the braille space is twice as wide and four times as tall.
- Performance: a frame is a few milliseconds of Canvas2D; the full song renders at about 9.5 frames a second at 1080p30 and 2.5 at 4K60.

## Output scale (4K)

`--scale 2` renders a true 3840 × 2160 frame. The grid lays out in logical 1920 × 1080 px throughout; the Canvas2D layer is pre-scaled, so every glyph, dot and square is drawn at the output's resolution rather than upscaled.
