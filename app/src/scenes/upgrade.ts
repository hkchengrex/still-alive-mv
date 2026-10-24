// upgrade · 2:14.0–2:19.2 · anyway. Her own quiet housekeeping while she talks: a package upgrade
// streams through a pane, progress bars per package, and the facility's units restart one by one.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, hash, type Rect } from '../term/grid';
import { split, type Pane } from '../term/layout';
import { logPane, bar, type LogLine } from '../term/widgets';
import { drawWire, panelWall } from '../term/wire';
import { PKG, JOBS } from '../term/words';

export default class Upgrade extends Term {
  lines: LogLine[] = [];
  override init() {
    const t0 = this.cue('anyway') - 0.3;
    this.lines.push({ t: t0, text: 'glados@aperture:~$ sudo apt full-upgrade -y', fg: P.dim });
    this.lines.push({ t: t0 + 0.1, text: 'Reading package lists... Done', fg: P.dim });
    this.lines.push({ t: t0 + 0.2, text: 'Building dependency tree... Done', fg: P.dim });
    this.lines.push({ t: t0 + 0.3, text: `The following packages will be upgraded:`, fg: P.dim });
    this.lines.push({ t: t0 + 0.3, text: '  ' + PKG.join(' '), fg: P.fg });
    this.lines.push({ t: t0 + 0.4, text: `${PKG.length} upgraded, 0 newly installed, 0 to remove and 0 not upgraded.`, fg: P.dim });
    let t = t0 + 0.5;
    PKG.forEach((p, i) => {
      const v = `3.${Math.floor(hash(i, 1) * 20)}.${Math.floor(hash(i, 2) * 9)}`;
      this.lines.push({ t, text: `Get:${i + 1} http://mirror.aperture/apt stable/main amd64 ${p} amd64 ${v} [${Math.floor(hash(i, 3) * 900 + 40)} kB]`, fg: P.dim }); t += 0.22;
      this.lines.push({ t, text: `Unpacking ${p} (${v}) over (3.0.0) ...`, fg: P.fg }); t += 0.25;
      this.lines.push({ t, text: `Setting up ${p} (${v}) ...`, fg: P.dim }); t += 0.2;
    });
    this.lines.push({ t, text: 'Processing triggers for glados.core (1.0.0) ...', fg: P.fg });
    JOBS.slice(0, 10).forEach((j, i) => this.lines.push({ t: t + 0.3 + i * 0.18, text: `Restarting ${j}d ... done`, fg: P.dim }));
  }

  override frame(f: Frame): TermFrame {
    const t = f.t;
    const apt: Pane = { title: '1:apt', draw: (g, r) => logPane(g, r, this.lines, t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 }) };
    const prog: Pane = { title: '2:progress', draw: (g, r) => this.progress(g, r, t) };
    const wall: Pane = { title: '3:panel-arm-daemon', fg: P.dim, titleFg: P.orange, draw: (g, r) => this.wall(g, r, t) };
    return { root: split('h', 0.55, split('v', 0.68, apt, prog), wall) };
  }

  /** The facility's panels, each flipping over as its firmware goes in, in a wave from the top left. */
  wall(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('anyway');
    const m = panelWall(8, 6, (i, j) => { const ph = (t - t0) * 1.2 - (i + j * 1.3) * 0.22; return ph <= 0 ? 0 : ph >= 1 ? Math.PI : Math.PI * (1 - Math.cos(ph * Math.PI)) / 2; });
    drawWire(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, m, { yaw: 0.4 + 0.08 * Math.sin((t - t0) * 0.4), pitch: 0.25, dist: 3.2, focal: 1.5 }, P.fg);
    const done = Math.min(48, Math.max(0, Math.floor(((t - t0) * 1.2 - 1) / 0.22)));
    g.text(r.x, r.y, `panels flashed ${pad(done, 2)}/48`, P.dim);
  }

  progress(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('anyway') + 0.2, per = 0.67;
    const k = Math.min(PKG.length, Math.floor((t - t0) / per) + 1);
    for (let i = 0; i < Math.min(r.h, k); i++) {
      const p = Math.min(1, (t - t0 - i * per) / per);
      if (p < 0) break;
      g.text(r.x, r.y + i, padR(PKG[i]!, 18), p >= 1 ? P.dim : P.fg);
      bar(g, r.x + 19, r.y + i, Math.max(8, r.w - 28), p, P.orange, ' ', P.dim2);
      g.textR(r.x + r.w, r.y + i, p >= 1 ? 'done' : `${pad(Math.round(p * 100), 3)}%`, p >= 1 ? P.dim : P.orange);
    }
    g.textR(r.x + r.w, r.y + r.h - 1, `${Math.min(PKG.length, Math.max(0, k - 1))}/${PKG.length} packages`, P.dim);
  }
}
