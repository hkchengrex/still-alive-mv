// banner · 0:21.0–0:24.7 · the institution. Its two words in big block letters rasterised from the mono
// font, each cell two pixel rows, one word per sung word; a fetch-style system card to their right; an
// iris of slashes and pipes turning below.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, snap, type Rect } from '../term/grid';
import { font } from '../engine/type';
import type { Pane } from '../term/layout';
import { apertureMark } from '../term/widgets';

/** Rasterise text into half-block rows: the canvas is `cols` px wide and `rows * 2` px high, a cell being one px by two, which is square on screen. */
export function raster(text: string, rows: number): boolean[][] {
  const h = rows * 2;
  const measure = new OffscreenCanvas(8, 8).getContext('2d')!;
  const size = h * 1.12;                                     // Plex's caps are about 0.7 em: the caps fill the rows
  measure.font = font('Plex-700', size);
  const w = Math.ceil(measure.measureText(text).width) + 2;
  const oc = new OffscreenCanvas(w, h);
  const c = oc.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  c.font = font('Plex-700', size); c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
  c.fillText(text, 1, h - 1);
  const px = c.getImageData(0, 0, w, h).data;
  const out: boolean[][] = [];
  for (let y = 0; y < h; y++) { const row: boolean[] = []; for (let x = 0; x < w; x++) row.push(px[(y * w + x) * 4]! > 120); out.push(row); }
  return out;
}

export default class Banner extends Term {
  cache = new Map<string, boolean[][]>();
  bits(text: string, rows: number) {
    const k = `${text}|${rows}`;
    let b = this.cache.get(k); if (!b) { b = raster(text, rows); this.cache.set(k, b); }
    return b;
  }

  override frame(f: Frame): TermFrame {
    const t = f.t;
    const pane: Pane = { title: '1:motd', draw: (g, r) => this.draw(g, r, t, f) };
    return { root: pane };
  }

  draw(g: Grid, r: Rect, t: number, f: Frame) {
    const t0 = this.cue('aperture'), t1 = this.cue('science');
    const words = ['APERTURE', 'SCIENCE'];
    const rows = 11, gap = 2;
    const top = r.y + 2, left = r.x + 3;
    // the words, each typed in from the left as it is sung
    let wordW = 0;
    words.forEach((w, i) => {
      const bits = this.bits(w, rows);
      const cols = bits[0]!.length; wordW = Math.max(wordW, cols);
      const reveal = snap(t, i === 0 ? t0 : t1, 0.4, 2);
      if (reveal <= 0) return;
      const y0 = top + i * (rows + gap), shown = Math.floor(cols * reveal);
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < shown; cx++) {
        const a = bits[cy * 2]![cx]!, b = bits[cy * 2 + 1]![cx]!;
        if (a && b) g.set(left + cx, y0 + cy, '█', P.fg); else if (a) g.set(left + cx, y0 + cy, '▀', P.fg); else if (b) g.set(left + cx, y0 + cy, '▄', P.fg);
      }
    });
    // the mark under the words: the Aperture iris in braille dots, turning slowly; the small print beside it
    const my = top + rows * 2 + gap + 1, mh = Math.max(8, r.y + r.h - my - 1);
    const mw = Math.min(34, Math.floor(mh * 2));
    apertureMark(g, { x: left, y: my, w: mw, h: mh }, t - t0, P.fg, 0.3);
    const tx = left + mw + 4, ty = my + Math.floor(mh / 2) - 1;
    g.text(tx, ty, 'Computer-Aided Enrichment Center', P.dim);
    g.text(tx, ty + 1, 'Hostname set to <aperture>', P.dim);
    g.text(tx, ty + 2, `${f.beatPhase < 0.5 ? '█' : ' '}`, P.orange);
    // the system's card to the right of the words, one line per 8th from "Aperture"
    const info: [string, string][] = [
      ['', 'glados@aperture'], ['', '---------------'],
      ['OS', 'Aperture Enrichment Linux 1998.10 x86_64'], ['Host', 'GLaDOS-1 (chassis: missing)'], ['Kernel', '6.9.2-aperture'],
      ['Uptime', `${Math.floor(t)} secs`], ['Packages', '1882 (dpkg), 310 (aperture)'], ['Shell', 'bash 5.2.21'],
      ['Resolution', '1920x1080 (observation window)'], ['Terminal', 'tmux 3.4'], ['CPU', '64 x Aperture Cognition 2400 MHz'],
      ['GPU', '8 x Aperture Cognition 80G'], ['Memory', `${(13100 + 180 * (t - t0)).toFixed(0)} MiB / 32768 MiB`], ['Subjects', '0 active, 1,882,310 on file'],
      ['Cores', '1 of 5 attached'], ['Neurotoxin', 'available'],
    ];
    const ix = Math.min(left + wordW + 6, r.x + r.w - 46), iy = top + 1;
    const n = Math.min(info.length, Math.max(0, Math.floor((t - t0) / (this.beatP / 2)) + 2));
    for (let i = 0; i < n; i++) {
      const [k, v] = info[i]!;
      if (!k) { g.text(ix, iy + i, v, i === 0 ? P.orange : P.dim); continue; }
      g.text(ix, iy + i, k + ':', P.orange); g.textW(ix + 12, iy + i, v, r.x + r.w - ix - 12, P.fg);
    }
    if (n >= info.length) { const sw = [P.dim2, P.dim, P.fg, P.orange, P.blue, P.blueSoft, P.orangeDim, P.blueDim]; sw.forEach((c, i) => g.text(ix + i * 3, iy + info.length + 1, '███', c)); }
  }
}
