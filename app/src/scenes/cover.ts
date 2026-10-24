// cover · the preview image: the terminal with the Aperture mark in dots, the two words in block letters, and the
// song's title typed on her prompt with the cursor lit. Reached with `--only cover`; rendered as a still.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, type Rect } from '../term/grid';
import type { Pane } from '../term/layout';
import { apertureMark } from '../term/widgets';
import { raster } from './banner';

export default class Cover extends Term {
  cache = new Map<string, boolean[][]>();
  bits(text: string, rows: number) { let b = this.cache.get(text + rows); if (!b) { b = raster(text, rows); this.cache.set(text + rows, b); } return b; }

  override frame(f: Frame): TermFrame {
    void f;
    const pane: Pane = { title: '1:motd', draw: (g, r) => this.draw(g, r) };
    return { root: pane, session: 'aperture', host: 'glados@aperture' };
  }

  draw(g: Grid, r: Rect) {
    // the prompt that ran it, top left
    g.text(r.x + 1, r.y, 'glados', P.orange); g.text(r.x + 7, r.y, '@aperture:~$ cat /etc/motd', P.dim);
    // the mark, left, as tall as the pane allows
    const mh = Math.min(30, r.h - 8), mw = Math.floor(mh * 2.05), my = r.y + 2 + Math.floor((r.h - 4 - mh) / 2);
    apertureMark(g, { x: r.x + 4, y: my, w: mw, h: mh }, 0, P.fg, 0);
    // the two words, right of the mark, stacked and centred on the mark's height
    const rows = 9, gap = 3;
    const words = ['APERTURE', 'SCIENCE'];
    const widths = words.map((w) => this.bits(w, rows)[0]!.length);
    const left = r.x + 4 + mw + 8;
    const avail = r.x + r.w - 2 - left;
    const scaleOk = Math.max(...widths) <= avail;
    const blockTop = my + Math.floor((mh - (rows * 2 + gap)) / 2);
    words.forEach((w, i) => {
      const bits = this.bits(w, rows), cols = bits[0]!.length;
      const x0 = left + (scaleOk ? Math.floor((avail - cols) / 2) : 0), y0 = blockTop + i * (rows + gap);
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols && x0 + cx < r.x + r.w - 1; cx++) {
        const a = bits[cy * 2]![cx]!, b = bits[cy * 2 + 1]![cx]!;
        if (a && b) g.set(x0 + cx, y0 + cy, '█', P.fg); else if (a) g.set(x0 + cx, y0 + cy, '▀', P.fg); else if (b) g.set(x0 + cx, y0 + cy, '▄', P.fg);
      }
    });
    // the small print under the words
    const sy = blockTop + rows * 2 + gap + 2;
    const motto = 'We do what we must because we can';
    g.bigText(left + Math.floor((avail - motto.length * 2) / 2), sy, motto, P.fg, 2);
    const line = 'Computer-Aided Enrichment Center';
    g.text(left + Math.floor((avail - line.length) / 2), sy + 3, line, P.dim);
  }

  /** The lyric pane carries the title, whole, with the cursor lit. */
  override lyricPane(): Pane {
    return {
      title: '0:glados', fg: P.dim, titleFg: P.orange,
      draw: (g: Grid, r: Rect) => {
        const x = r.x + 1, by = r.y + 1;
        g.text(x, r.y, '> ', P.dim2); g.text(x + 2, r.y, 'a music video, rendered as a terminal', P.dim);
        g.bigText(x, by, '>', P.orange, 3);
        g.bigText(x + 6, by, 'Still Alive', P.fg, 3);
        const cx = x + 6 + 'Still Alive'.length * 3;
        for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) g.set(cx + dx, by + dy, '█', P.orange);
      },
    };
  }
}
