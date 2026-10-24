// The character grid: the whole video is 176 x 50 cells of IBM Plex Mono on a near-black field.
// A Grid holds a character, a foreground and a background per cell, plus a braille-dot overlay
// (2 x 4 dots per cell) for line art; `render` paints it on a Canvas2D context. Box-drawing and
// block characters are drawn as rectangles, so they meet exactly; the rest is the font.
import { font } from '../engine/type';

export const COLS = 176, ROWS = 50;
export const CW = 10.8, CH = 21.6, FONT = 18;
/** The left margin that centres the grid in 1920 px. */
export const X0 = (1920 - COLS * CW) / 2;
export const FACE = 'Plex-500';

/** The terminal's palette. */
export const P = {
  bg: '#0C0D10',
  fg: '#D9D7CD',
  dim: '#5C5F68',
  dim2: '#33363D',
  orange: '#F36B32',
  blue: '#3A8BE0',
  /** A fainter orange and blue, for fills behind type. */
  orangeDim: '#5A2B16',
  blueDim: '#17365A',
  /** The light blue of the figure's training runs. */
  blueSoft: '#6FA8E6',
} as const;
export type Color = string;

export interface Rect { x: number; y: number; w: number; h: number }
export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
export const inset = (r: Rect, n = 1): Rect => rect(r.x + n, r.y + n, Math.max(0, r.w - 2 * n), Math.max(0, r.h - 2 * n));

// box-drawing by connection bits: 1 up, 2 down, 4 left, 8 right
const U = 1, D = 2, L = 4, R = 8;
const BOX: Record<string, number> = {
  '─': L | R, '│': U | D, '┌': R | D, '┐': L | D, '└': R | U, '┘': L | U,
  '├': U | D | R, '┤': U | D | L, '┬': L | R | D, '┴': L | R | U, '┼': U | D | L | R,
  '╴': L, '╶': R, '╵': U, '╷': D,
};
const BITS_TO_BOX: string[] = [];
for (const [ch, b] of Object.entries(BOX)) BITS_TO_BOX[b] = ch;
export const boxChar = (bits: number) => BITS_TO_BOX[bits] ?? ' ';
export const boxBits = (ch: string) => BOX[ch] ?? 0;

// block elements drawn as rects: fractions of the cell filled (x, y, w, h in cell units) and a cover for shades
const BLOCKS: Record<string, [number, number, number, number]> = {
  '█': [0, 0, 1, 1], '▀': [0, 0, 1, 0.5], '▄': [0, 0.5, 1, 0.5], '▌': [0, 0, 0.5, 1], '▐': [0.5, 0, 0.5, 1],
  '▁': [0, 7 / 8, 1, 1 / 8], '▂': [0, 6 / 8, 1, 2 / 8], '▃': [0, 5 / 8, 1, 3 / 8], '▅': [0, 3 / 8, 1, 5 / 8], '▆': [0, 2 / 8, 1, 6 / 8], '▇': [0, 1 / 8, 1, 7 / 8],
  '▏': [0, 0, 1 / 8, 1], '▎': [0, 0, 2 / 8, 1], '▍': [0, 0, 3 / 8, 1], '▋': [0, 0, 5 / 8, 1], '▊': [0, 0, 6 / 8, 1], '▉': [0, 0, 7 / 8, 1],
  '■': [0.12, 0.31, 0.76, 0.38], '▪': [0.25, 0.35, 0.5, 0.3],
};
const SHADES: Record<string, number> = { '░': 0.25, '▒': 0.5, '▓': 0.75 };

export class Grid {
  ch: string[] = new Array(COLS * ROWS).fill(' ');
  fg: Color[] = new Array(COLS * ROWS).fill(P.fg);
  bg: (Color | null)[] = new Array(COLS * ROWS).fill(null);
  /** Braille dots: 8 bits per cell (columns 0..1 x rows 0..3 as in the braille block), and their colour. */
  dots = new Uint8Array(COLS * ROWS);
  dotFg: Color[] = new Array(COLS * ROWS).fill(P.fg);
  /** The current clip: writes outside it are dropped. */
  clip: Rect = rect(0, 0, COLS, ROWS);
  /** Text drawn at a multiple of the cell size (the lyric): each glyph covers scale x scale cells. */
  big: { x: number; y: number; s: string; fg: Color; scale: number }[] = [];
  /** Small filled rectangles in cell units (x, y may be fractional), painted over the glyphs: for maps denser than the grid. */
  rects: { x: number; y: number; w: number; h: number; fg: Color }[] = [];

  clear() {
    this.ch.fill(' '); this.fg.fill(P.fg); this.bg.fill(null); this.dots.fill(0); this.dotFg.fill(P.fg);
    this.clip = rect(0, 0, COLS, ROWS);
    this.big = [];
    this.rects = [];
  }
  /** A filled rectangle at cell coordinates (fractional), clipped by the cell it starts in. */
  cellRect(x: number, y: number, w: number, h: number, fg: Color) { if (this.inClip(Math.floor(x), Math.floor(y))) this.rects.push({ x, y, w, h, fg }); }
  /** Big text from cell (x, y), each glyph `scale` cells wide and high; the cells under it are not touched. */
  bigText(x: number, y: number, s: string, fg: Color = P.fg, scale = 2) { this.big.push({ x, y, s, fg, scale }); return x + s.length * scale; }
  inClip(x: number, y: number) { const c = this.clip; return x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h; }
  withClip(r: Rect, fn: () => void) {
    const prev = this.clip;
    const x0 = Math.max(prev.x, r.x), y0 = Math.max(prev.y, r.y);
    const x1 = Math.min(prev.x + prev.w, r.x + r.w), y1 = Math.min(prev.y + prev.h, r.y + r.h);
    this.clip = rect(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    try { fn(); } finally { this.clip = prev; }
  }

  set(x: number, y: number, ch: string, fg?: Color, bg?: Color | null) {
    x = Math.round(x); y = Math.round(y);
    if (!this.inClip(x, y)) return;
    const i = y * COLS + x;
    this.ch[i] = ch;
    if (fg !== undefined) this.fg[i] = fg;
    if (bg !== undefined) this.bg[i] = bg;
  }
  /** Write a string from (x, y); a negative x clips the start. Returns the x after the text. */
  text(x: number, y: number, s: string, fg: Color = P.fg, bg?: Color | null): number {
    x = Math.round(x); y = Math.round(y);
    for (let i = 0; i < s.length; i++) this.set(x + i, y, s[i]!, fg, bg);
    return x + s.length;
  }
  /** Text clipped to a width (with an ellipsis mark when cut). */
  textW(x: number, y: number, s: string, w: number, fg: Color = P.fg, bg?: Color | null) {
    if (s.length > w) s = w > 1 ? s.slice(0, w - 1) + '…' : s.slice(0, w);
    return this.text(x, y, s, fg, bg);
  }
  /** Right-aligned text ending at x1 (exclusive). */
  textR(x1: number, y: number, s: string, fg: Color = P.fg, bg?: Color | null) { return this.text(x1 - s.length, y, s, fg, bg); }
  textC(r: Rect, y: number, s: string, fg: Color = P.fg, bg?: Color | null) { return this.text(r.x + Math.floor((r.w - s.length) / 2), y, s, fg, bg); }
  fill(r: Rect, ch = ' ', fg: Color = P.fg, bg: Color | null = null) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.set(x, y, ch, fg, bg);
  }
  fillBg(r: Rect, bg: Color | null) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { if (this.inClip(x, y)) this.bg[y * COLS + x] = bg; }
  }
  /** Recolour the glyphs in a rect (for dimming a pane). */
  tint(r: Rect, fg: Color) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { if (this.inClip(x, y)) { const i = y * COLS + x; this.fg[i] = fg; this.dotFg[i] = fg; } }
  }

  /** A box-drawing line: merges with lines already there (the junctions resolve themselves). */
  hline(x0: number, x1: number, y: number, fg: Color) { for (let x = x0; x <= x1; x++) this.join(x, y, (x > x0 ? L : 0) | (x < x1 ? R : 0), fg); }
  vline(x: number, y0: number, y1: number, fg: Color) { for (let y = y0; y <= y1; y++) this.join(x, y, (y > y0 ? U : 0) | (y < y1 ? D : 0), fg); }
  join(x: number, y: number, bits: number, fg: Color) {
    if (!this.inClip(x, y)) return;
    const i = y * COLS + x;
    const have = boxBits(this.ch[i]!);
    this.ch[i] = boxChar(have | bits); this.fg[i] = fg;
  }
  /** A box on the rect's perimeter. */
  box(r: Rect, fg: Color) {
    if (r.w < 2 || r.h < 2) return;
    const x1 = r.x + r.w - 1, y1 = r.y + r.h - 1;
    this.hline(r.x, x1, r.y, fg); this.hline(r.x, x1, y1, fg);
    this.vline(r.x, r.y, y1, fg); this.vline(x1, r.y, y1, fg);
  }

  // ---- braille dots (x, y in dot units: 2 per cell across, 4 down)
  dot(dx: number, dy: number, fg: Color) {
    const cx = dx >> 1, cy = dy >> 2;
    if (!this.inClip(cx, cy)) return;
    const i = cy * COLS + cx;
    this.dots[i]! |= 1 << ((dy & 3) + (dx & 1) * 4);
    this.dotFg[i] = fg;
  }
  /** A line in dot space (Bresenham). */
  dline(x0: number, y0: number, x1: number, y1: number, fg: Color) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4000; n++) {
      this.dot(x0, y0, fg);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  dcircle(cx: number, cy: number, r: number, fg: Color, a0 = 0, a1 = Math.PI * 2) {
    const n = Math.max(12, Math.ceil(r * 1.5));
    let px = cx + r * Math.cos(a0), py = cy + r * Math.sin(a0);
    for (let i = 1; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      this.dline(px, py, x, y, fg); px = x; py = y;
    }
  }

  /** Paint the grid. */
  render(c: CanvasRenderingContext2D) {
    c.fillStyle = P.bg; c.fillRect(0, 0, 1920, 1080);
    c.font = font(FACE, FONT);
    c.textBaseline = 'alphabetic';
    const baseY = CH * 0.74;
    // backgrounds as runs
    for (let y = 0; y < ROWS; y++) {
      let x = 0;
      while (x < COLS) {
        const b = this.bg[y * COLS + x];
        if (!b) { x++; continue; }
        let x2 = x + 1;
        while (x2 < COLS && this.bg[y * COLS + x2] === b) x2++;
        c.fillStyle = b; c.fillRect(X0 + x * CW, y * CH, (x2 - x) * CW, CH);
        x = x2;
      }
    }
    // glyphs: font runs of one colour; box and block characters as rects
    const py = (y: number) => y * CH;
    for (let y = 0; y < ROWS; y++) {
      let x = 0;
      while (x < COLS) {
        const i = y * COLS + x, ch = this.ch[i]!;
        if (ch === ' ') { x++; continue; }
        const fg = this.fg[i]!;
        const bits = BOX[ch];
        if (bits !== undefined) {
          c.fillStyle = fg;
          const cx = X0 + x * CW, cy = py(y), mx = cx + CW / 2, my = cy + CH / 2, t = 2;
          if (bits & L) c.fillRect(cx, my - t / 2, CW / 2 + t / 2, t);
          if (bits & R) c.fillRect(mx - t / 2, my - t / 2, CW / 2 + t / 2, t);
          if (bits & U) c.fillRect(mx - t / 2, cy, t, CH / 2 + t / 2);
          if (bits & D) c.fillRect(mx - t / 2, my - t / 2, t, CH / 2 + t / 2);
          x++; continue;
        }
        const blk = BLOCKS[ch];
        if (blk) {
          c.fillStyle = fg;
          c.fillRect(X0 + (x + blk[0]) * CW, py(y) + blk[1] * CH, blk[2] * CW + 0.3, blk[3] * CH + 0.3);
          x++; continue;
        }
        const sh = SHADES[ch];
        if (sh) {
          c.globalAlpha = sh; c.fillStyle = fg; c.fillRect(X0 + x * CW, py(y), CW + 0.3, CH + 0.3); c.globalAlpha = 1;
          x++; continue;
        }
        // a run of ordinary glyphs in one colour
        let x2 = x + 1, s = ch;
        while (x2 < COLS) {
          const j = y * COLS + x2, c2 = this.ch[j]!;
          if (this.fg[j] !== fg || BOX[c2] !== undefined || BLOCKS[c2] || SHADES[c2]) break;
          s += c2; x2++;
        }
        c.fillStyle = fg;
        c.fillText(s, X0 + x * CW, py(y) + baseY);
        x = x2;
      }
    }
    // big text
    for (const b of this.big) {
      c.font = font(FACE, FONT * b.scale); c.fillStyle = b.fg;
      c.fillText(b.s, X0 + b.x * CW, b.y * CH + baseY * b.scale);
    }
    c.font = font(FACE, FONT);
    for (const q of this.rects) { c.fillStyle = q.fg; c.fillRect(X0 + q.x * CW, q.y * CH, q.w * CW, q.h * CH); }
    // braille dots
    const dw = CW / 2, dh = CH / 4, ds = 3.2;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x, d = this.dots[i]!;
      if (!d) continue;
      c.fillStyle = this.dotFg[i]!;
      for (let k = 0; k < 8; k++) if (d & (1 << k)) {
        const col = k >> 2, row = k & 3;
        c.fillRect(X0 + x * CW + col * dw + (dw - ds) / 2, y * CH + row * dh + (dh - ds) / 2, ds, ds);
      }
    }
  }
}

// ---- deterministic randomness
export function hash(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const pick = <T>(arr: readonly T[], r: number): T => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))]!;
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0→1 from t0 over dur, fast off the mark and a hard settle. */
export const snap = (t: number, t0: number, dur = 0.25, k = 3) => { const u = clamp01((t - t0) / dur); return 1 - (1 - u) ** k; };
export const smooth = (t: number, t0: number, t1: number) => { const u = clamp01((t - t0) / (t1 - t0)); return u * u * (3 - 2 * u); };
export const pad = (n: number | string, w: number, ch = ' ') => String(n).padStart(w, ch);
export const padR = (s: string, w: number) => s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
/** Time quantised to a refresh period (a monitor's readouts update at its rate, not every frame). */
export const held = (t: number, period = 1, phase = 0) => Math.floor((t - phase) / period) * period + phase;
export const hhmmss = (t: number) => `${pad(Math.floor(t / 3600), 2, '0')}:${pad(Math.floor(t / 60) % 60, 2, '0')}:${pad(Math.floor(t) % 60, 2, '0')}`;
