// hosts · 1:43.2–1:48.7 · the larger system. The screen pulls back: it becomes one tile among many,
// the view splitting 2 x 2, 4 x 4, 8 x 8 over the break, each tile a running terminal on another host,
// every one of them hers.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, hash, type Rect } from '../term/grid';
import { mosaic, type Node, type Pane } from '../term/layout';
import { logPane, type LogLine } from '../term/widgets';
import { drawWire, turret } from '../term/wire';
import { HOSTS, JOBS } from '../term/words';

export default class Hosts extends Term {
  override frame(f: Frame): TermFrame {
    const t = f.t, t0 = this.ctx.start;
    // 1, 4, 16, 64 tiles: a split every bar and a half
    const k = Math.min(3, Math.floor((t - t0) / (this.beatP * 3) + 0.01));
    const side = 2 ** k, n = side * side;
    const panes: Node[] = [];
    for (let i = 0; i < n; i++) panes.push(this.tile(i, k, t, f));
    return { root: mosaic(panes, side), session: k === 0 ? 'aperture' : `aperture × ${n}`, host: `glados@${HOSTS[Math.min(HOSTS.length - 1, n % HOSTS.length)]}` };
  }

  tile(i: number, k: number, t: number, f: Frame): Pane {
    const host = k === 0 ? 'aperture' : `${HOSTS[(i * 7 + k) % HOSTS.length]}-${pad((i * 13 + k * 5) % 97, 2, '0')}`;
    const lines: LogLine[] = [];
    const t0 = this.ctx.start - 6 - hash(i, k, 1) * 6;
    for (let j = 0; j < 120; j++) {
      const job = JOBS[(i + j * 3) % JOBS.length]!;
      lines.push({ t: t0 + j * (0.08 + 0.1 * hash(i, j, k)), text: `${pad(((t0 + j) % 60).toFixed(0), 2, '0')}.${pad(Math.floor(hash(i, j, 2) * 100), 2, '0')} ${job}: ${['ok', 'seated', 'queued', 'written', 'polled', 'synced', 'heartbeat'][Math.floor(hash(i, j, 3) * 7)]}`, fg: j % 9 === 4 ? P.fg : P.dim });
    }
    return {
      title: k >= 3 ? '' : `${host}`, fg: P.dim, titleFg: P.orange,
      draw: (g: Grid, r: Rect) => {
        if (k >= 1 && i % 2 === 1) { const open = Math.max(0, 1 - f.beatPhase * 2.5); drawWire(g, r, turret(open), { yaw: 0.4 * Math.sin(t * 0.8 + i) + i, pitch: 0.15, dist: 3.6, focal: 1.6 }, open > 0.3 ? P.orange : P.fg); return; }
        logPane(g, { x: r.x, y: r.y, w: r.w, h: r.h - 1 }, lines, t, { bottom: true });
        const y = r.y + r.h - 1;
        if (r.w > 12) { g.text(r.x, y, 'glados', P.orange); g.textW(r.x + 6, y, `@${host}:~$`, r.w - 7, P.dim); }
        else g.text(r.x, y, '$', P.orange);
        if (f.beatPhase < 0.5) g.set(Math.min(r.x + r.w - 1, r.x + (r.w > 12 ? 9 + host.length : 2)), y, '█', P.orange);
      },
    };
  }
}
