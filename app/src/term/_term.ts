// The terminal scene base: a grid, a layout tree per frame, the lyric pane and the status bar.
// A scene implements `frame(f)` and returns the tree of panes for that moment; the kit lays it out,
// adds the `glados` lyric pane under it and the status bar, and paints the grid.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { Grid, COLS, ROWS, P, rect, hhmmss, type Rect, type Color } from './grid';
import { layout, drawPanes, splitFixed, type Node, type Pane, type Placed } from './layout';
import type { Cues } from '../timeline';

export interface TermFrame {
  /** The tree above the lyric pane; null for a bare screen. */
  root: Node | null;
  /** Show the lyric pane (default true) and the status bar (default true). */
  lyric?: boolean;
  status?: boolean;
  /** The session name and host in the status bar. */
  session?: string;
  host?: string;
  /** Extra window names in the status bar (hosts she has reached, for instance). */
  windows?: string[];
  /** Colour of the status bar's left tag. */
  tagFg?: Color;
  /** Called after the panes are drawn (for things over the whole screen). */
  over?: (g: Grid) => void;
}

export const LYRIC_ROWS = 4;

/** The lead on the voice (s): one 8th note at the song's tempo, so each word is whole on screen before it is sung. */
const TYPE_LEAD = 0.25;
/** The slowest the letters come (characters a second): a long word may take longer than the lead, and lands a little late. */
const TYPE_MIN_RATE = 20;
/**
 * How many characters of a line have been typed at t: each word's letters are typed across its lead, so the word is
 * whole as its onset arrives (a word longer than the lead allows at TYPE_MIN_RATE starts earlier); the space with the
 * next word. The typing is visible and the word is on screen with the voice.
 */
function typedChars(line: { text: string; words: { w: string; start: number; end: number }[] }, t: number): number {
  let chars = 0;
  for (const w of line.words) {
    const dur = Math.max(TYPE_LEAD, w.w.length / TYPE_MIN_RATE);
    const t0 = w.start - dur;
    if (t < t0) break;
    const p = Math.min(1, (t - t0) / dur);
    chars += p * w.w.length;
    if (p < 1) break;
    chars += 1;
  }
  return Math.min(chars, line.text.length);
}

export abstract class Term extends Scene {
  layer = new Layer2D();
  grid = new Grid();
  abstract frame(f: Frame): TermFrame;

  get c() { return this.layer.ctx; }
  get cues(): Cues { return (this.ctx.params.cues ?? {}) as Cues; }
  cue(name: string) { const c = this.cues[name]; return c === undefined ? Infinity : c; }
  get beatP() { return 60 / this.ctx.audio.bpm; }
  /** The beats (song seconds) in [t0, t1). */
  beatsIn(t0: number, t1: number) { return this.ctx.audio.beats.filter((b) => b >= t0 && b < t1); }
  /** The k-th beat at or after t. */
  beatAfter(t: number, k = 0) { const b = this.ctx.audio.beats.find((x) => x >= t - 1e-6); return (b ?? t) + k * this.beatP; }
  bar(k: number) { return this.ctx.audio.downbeats[0]! + k * 4 * this.beatP; }
  /** How many beats have passed since t0 (fractional). */
  beatsSince(t: number, t0: number) { return (t - t0) / this.beatP; }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const g = this.grid;
    g.clear();
    const tf = this.frame(f);
    const showLyric = tf.lyric !== false, showStatus = tf.status !== false;
    const area = rect(0, 0, COLS, ROWS - 1);                       // the bar's row stays reserved even when the bar is hidden, so no pane resizes
    let placed: Placed[] = [];
    if (tf.root) {
      const tree = showLyric ? splitFixed('v', LYRIC_ROWS, tf.root, this.lyricPane(f)) : tf.root;
      placed = layout(tree, area);
      drawPanes(g, placed);
    } else if (showLyric) {
      placed = layout(this.lyricPane(f), rect(0, area.h - (LYRIC_ROWS + 2), COLS, LYRIC_ROWS + 2));
      drawPanes(g, placed);
    }
    if (showStatus) this.statusBar(f, tf, placed);
    tf.over?.(g);
    this.layer.clear(P.bg);
    g.render(this.c);
    this.ctx.comp.draw(this.ctx.renderer, this.layer.upload(), out, { mode: 'replace' });
    return { bloom: 0, halation: 0, ca: 0, grain: 0, vignette: 0, hud: 0, frame: 0, pdoom: 0, exposure: 1 };
  }
  override dispose() { this.layer.texture.dispose(); }

  /** The lyric pane: the previous line dimmed at the grid's size, the current line at twice it, typed as it is sung, a block cursor. */
  lyricPane(f: Frame): Pane {
    const ly = this.ctx.lyrics;
    return {
      title: '0:glados', fg: P.dim, titleFg: P.orange,
      draw: (g: Grid, r: Rect) => {
        const line = ly.lastLine(f.t);
        const prev = line ? ly.lines[line.i - 1] : null;
        const x = r.x + 1;
        if (prev) { g.text(x, r.y, '> ', P.dim2); g.textW(x + 2, r.y, prev.text, r.w - 3, P.dim); }
        const by = r.y + 1;                                           // the big line takes rows 1..2 of the pane; row 3 is air
        if (!line) { g.bigText(x, by, '>', P.orange); if (f.beatPhase < 0.5) this.cursor(g, x + 4, by); return; }
        const n = Math.floor(typedChars(line, f.t));
        const text = line.text.slice(0, n), done = n >= line.text.length;
        g.bigText(x, by, '>', P.orange);
        g.bigText(x + 4, by, text, P.fg);
        if (!done || f.beatPhase < 0.5) this.cursor(g, x + 4 + text.length * 2, by);
      },
    };
  }
  /** The big cursor: a block two cells wide and two high. */
  cursor(g: Grid, x: number, y: number) { g.set(x, y, '█', P.orange); g.set(x + 1, y, '█', P.orange); g.set(x, y + 1, '█', P.orange); g.set(x + 1, y + 1, '█', P.orange); }

  /** tmux's status line: the session tag, the window list, the host and the clock. */
  statusBar(f: Frame, tf: TermFrame, placed: Placed[]) {
    const g = this.grid, y = ROWS - 1;
    g.fill(rect(0, y, COLS, 1), ' ', P.fg, P.dim2);
    const tag = ` [${tf.session ?? 'aperture'}] `;
    g.text(0, y, tag, P.bg, tf.tagFg ?? P.fg);
    let x = tag.length + 1;
    const names = [...new Set([...placed.map((p) => p.pane.title).filter(Boolean), ...(tf.windows ?? [])])];
    for (const n of names) {
      if (x + n.length + 2 > COLS - 34) { g.text(x, y, '…', P.dim); break; }
      x = g.text(x, y, ' ' + n + ' ', n.startsWith('0:') ? P.fg : P.dim);
    }
    const right = ` ${tf.host ?? 'glados@aperture'}  ${hhmmss(f.t)} `;
    g.text(COLS - right.length, y, right, P.bg, P.dim);
  }
}
