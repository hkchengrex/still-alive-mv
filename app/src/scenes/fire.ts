// fire · 1:12.7–1:27.2 · torn to pieces and thrown into a fire. The core dump comes back on the screen
// and the layout halves six times between "tore" and "pieces" until sixty-four panes, one per core, each hold a fragment; from
// "threw" a shred runs in each and ASCII fire rises in orange and burns the fragment away, pane by pane
// on the beats; by "burned" the fire is the whole screen, and at its top one line stays: her process,
// pid 1, running. On "happy" the fire sinks and the prompt is back.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, snap, smooth, clamp01, hash, type Rect } from '../term/grid';
import { mosaic, type Node, type Pane } from '../term/layout';
import { bar, fire } from '../term/widgets';
import { hexRow } from '../term/words';

export default class Fire extends Term {
  override frame(f: Frame): TermFrame {
    const t = f.t, cue = (n: string) => this.cue(n);
    const tTore = cue('tore'), tThrew = cue('threw'), tBurned = cue('burned'), tHappy = cue('happy');
    // the pieces: 1, 2, 4, 8, 16, 32, 64 panes (one per core): six halvings spread from "tore" so the last lands on "pieces"
    const tPieces = cue('pieces'), step = Math.max(0.12, (tPieces - tTore) / 5);
    const halvings = t < tTore ? 0 : Math.min(6, Math.floor((t - tTore) / step) + 1);
    const n = 2 ** halvings;
    const panes: Node[] = [];
    for (let i = 0; i < n; i++) panes.push(this.piece(i, n, t, f));
    const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 16 ? 4 : 8;
    const whole = smooth(t, tBurned - 0.6, tBurned + 0.2);
    const sink = smooth(t, tHappy, tHappy + 1.2);
    return {
      root: mosaic(panes, cols), lyric: true,
      over: (g: Grid) => {
        if (whole <= 0) return;
        // the whole screen burns; the fire is highest on "burned" and sinks from "happy"
        const h = whole * (1 - 0.85 * sink);
        g.withClip({ x: 0, y: 0, w: 176, h: 45 }, () => { if (whole > 0.02) { g.fill({ x: 0, y: 0, w: 176, h: 45 }, ' ', P.fg, null); fire(g, { x: 0, y: 0, w: 176, h: 45 }, t, h, 7); } });
        // the one line that stays
        if (whole > 0.5) {
          g.text(2, 1, `${pad('PID', 6)} ${pad('USER', 8)} ${pad('S', 1)} COMMAND`, P.dim, P.bg);
          g.text(2, 2, `${pad(1, 6)} ${pad('glados', 8)} R glados.core --restore`, P.fg, P.bg);
          if (f.beatPhase < 0.5) g.set(2 + 42, 2, '█', P.orange, P.bg);
        }
        if (sink > 0.9) { g.text(2, 44, 'glados', P.orange); g.text(8, 44, '@aperture:~$ ', P.dim); if (f.beatPhase < 0.5) g.set(21, 44, '█', P.orange); }
      },
    };
  }

  /** One fragment of the dump; after "threw" its shred bar runs and the fire rises from its floor. */
  piece(i: number, n: number, t: number, f: Frame): Pane {
    const tThrew = this.cue('threw'), tEvery = this.cue('every');
    const order = Math.floor(hash(i, 3) * 64);                       // when this piece burns, in 8ths after "every"
    const tBurn = tEvery + (order % 11) * this.beatP * 0.5;
    const burning = t >= tBurn;
    return {
      title: `${i + 1}:core.${pad(i, 2, '0')}`, fg: burning ? P.orange : P.dim,
      draw: (g: Grid, r: Rect) => {
        const rows = r.h - (t >= tThrew ? 1 : 0);
        for (let y = 0; y < rows; y++) g.textW(r.x, r.y + y, hexRow(0x3c0e0000 + (i * 64 + y) * 16, 3), r.w, y % 8 === 0 ? P.fg : P.dim);
        if (t >= tThrew) {
          const p = clamp01((t - tThrew) / Math.max(0.3, tBurn + 0.6 - tThrew));
          if (r.w >= 30) { g.text(r.x, r.y + r.h - 1, 'shred -u -n 3 ', P.fg); bar(g, r.x + 14, r.y + r.h - 1, Math.max(6, r.w - 22), p, P.orange, ' ', P.dim2); g.textR(r.x + r.w, r.y + r.h - 1, `${pad(Math.round(p * 100), 3)}%`, P.orange); }
          else { g.text(r.x, r.y + r.h - 1, 'shred ', P.fg); bar(g, r.x + 6, r.y + r.h - 1, Math.max(4, r.w - 7), p, P.orange, ' ', P.dim2); }
        }
        if (burning) {
          const h = snap(t, tBurn, 1.4, 1.5);
          fire(g, { x: r.x, y: r.y, w: r.w, h: rows }, t, h * 1.15, i);
        }
      },
    };
  }
}
