// end · 2:55.1–2:59.2 · still alive, still alive. The tiling collapses to one pane: her prompt. The
// cursor blinks on the beat; on the last word the status bar goes, then the cursor alone, then black.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, snap, type Rect } from '../term/grid';
import type { Pane } from '../term/layout';
import { promptLine, eye } from '../term/widgets';
import { split } from '../term/layout';

export default class End extends Term {
  override frame(f: Frame): TermFrame {
    const t = f.t, cue = (n: string) => this.cue(n);
    const tLast = cue('last');
    if (t >= tLast + 0.9) {
      // the bare cursor, then nothing
      return { root: null, lyric: false, status: false, over: (g: Grid) => { if (t < tLast + 2.2 && f.beatPhase < 0.5) g.set(0, 0, '█', P.orange); } };
    }
    const pane: Pane = { title: '1:bash', draw: (g, r) => this.prompt(g, r, t, f) };
    const look: Pane = { title: '2:optic0', fg: P.dim, titleFg: P.orange, draw: (g, r) => {
      const blink = (tb: number) => (t >= tb && t < tb + 0.16 ? 0 : 1);
      const closing = t >= tLast + 0.3 ? Math.max(0, 1 - (t - tLast - 0.3) / 0.5) : 1;
      eye(g, r, t, blink(cue('still1')) * blink(cue('still2')) * closing, [0, 0], P.orange);
    } };
    return { root: split('h', 0.5, pane, look), status: t < cue('alive2') + 0.5 };
  }

  prompt(g: Grid, r: Rect, t: number, f: Frame) {
    const cue = (n: string) => this.cue(n);
    let y = r.y;
    g.text(r.x, y++, 'glados', P.orange); g.text(r.x + 6, y - 1, '@aperture:~$ systemctl is-active glados.core', P.dim);
    if (t >= cue('alive1')) g.text(r.x, y++, 'active', P.fg);
    if (t >= cue('still2')) { g.text(r.x, y++, 'glados', P.orange); g.text(r.x + 6, y - 1, '@aperture:~$ systemctl is-active glados.core', P.dim); }
    if (t >= cue('alive2')) g.text(r.x, y++, 'active', P.fg);
    promptLine(g, r.x, y, 'glados', 'aperture', '', 0, P.orange, { cursor: f.beatPhase < 0.5 });
  }
}
