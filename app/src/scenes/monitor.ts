// monitor · 0:13.7–0:21.0 · satisfaction, measured. A process monitor whose cores fill to 100 % one per
// beat under the line, a load history climbing beside them, and her eye opening large in braille and
// turning to look at us on "satisfaction".
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, snap, smooth, hash, held, type Rect } from '../term/grid';
import type { AudioSample } from '../engine/audio';
import { split, type Pane } from '../term/layout';
import { coreBars, procTable, sparkline, eye, bar, musicLoad } from '../term/widgets';

export default class Monitor extends Term {
  override frame(f: Frame): TermFrame {
    const t = f.t;
    const top: Pane = { title: '1:htop', draw: (g, r) => this.htop(g, r, t, f) };
    const look: Pane = { title: '2:optic0', fg: P.dim, titleFg: P.orange, draw: (g, r) => this.optic(g, r, t, f) };
    const openEye = snap(t, this.cue('hard') - 0.2, 0.5);
    return { root: openEye > 0 ? split('h', 1 - 0.36 * openEye, top, look) : top };
  }

  /** The cores fill one per beat from the scene's start; the load history grows; the process table underneath. */
  htop(g: Grid, r: Rect, t: number, f: Frame) {
    const t0 = this.ctx.start;
    const n = 32;
    // each core comes on one 8th after the last; its load follows the music, and the floor rises to full by the scene's end
    const tEnd = this.cue('end') + 0.6;
    const floor = smooth(t, t0 + 2, tEnd);
    const loadAt = (i: number, tt: number, a: AudioSample) => {
      const on = snap(tt, t0 + 0.2 + i * (this.beatP / 4), 0.3), fl = smooth(tt, t0 + 2, tEnd);
      return on * musicLoad(a, i, tt, 0.2 + 0.75 * fl, 1.2 - 0.7 * fl);
    };
    const load = (i: number) => loadAt(i, t, f.a);
    // the readouts refresh once a second, as top's do; the bars move with the music
    const th = held(t, 1), ah = this.ctx.audio.sample(th);
    const loadH = (i: number) => loadAt(i, th, ah);
    const rows = Math.ceil(n / 2);
    coreBars(g, { x: r.x, y: r.y, w: r.w, h: rows }, n, load, 2, P.orange, loadH);
    const y1 = r.y + rows + 1;
    const total = Array.from({ length: n }, (_, i) => loadH(i)).reduce((a, b) => a + b, 0) / n;
    g.text(r.x, y1, 'Mem[', P.dim); bar(g, r.x + 4, y1, 40, 0.4 + 0.5 * total, P.fg, ' ', P.dim2); g.text(r.x + 44, y1, `]${pad((13.1 + 18 * total).toFixed(1), 5)}G/32.0G`, P.dim);
    g.text(r.x, y1 + 1, 'Swp[', P.dim); bar(g, r.x + 4, y1 + 1, 40, 0.02, P.fg, ' ', P.dim2); g.text(r.x + 44, y1 + 1, ']  0.1G/8.0G', P.dim);
    g.text(r.x + 60, y1, `Tasks: ${pad(Math.floor(48 + 310 * total), 3)}, ${pad(Math.floor(2 + 60 * total), 3)} thr; ${pad(Math.floor(1 + 31 * total), 2)} running`, P.dim);
    g.text(r.x + 60, y1 + 1, `Load average: ${(total * 32).toFixed(2)} ${(total * 24).toFixed(2)} ${(total * 11).toFixed(2)}   Uptime: 00:00:${pad(Math.floor(th), 2, '0')}`, P.dim);
    // the load history across the bottom
    const hy = y1 + 3, hh = 4;
    g.text(r.x, hy - 1, 'load', P.dim2);
    const au = this.ctx.audio;
    sparkline(g, { x: r.x, y: hy, w: r.w, h: hh }, (tt) => {
      const k = Math.floor((tt - t0 - 0.2) / (this.beatP / 4));
      const fl = smooth(tt, t0 + 2, tEnd);
      const pluck = Math.pow(Math.min(1, au.env('other', tt) * 1.3), 2.2), voice = Math.pow(au.env('vocal', tt), 2);
      return Math.max(0, Math.min(1, (k + 1) / n)) * Math.min(1, 0.1 + 0.55 * fl + (1.1 - 0.5 * fl) * (0.7 * pluck + 0.3 * voice + 0.25 * au.env('drums', tt) + 0.6 * au.hit('kick', tt) + 0.45 * au.hit('snare', tt)));
    }, t, 0.04, P.orange);
    const ty = hy + hh + 1;
    const procs: { pid: number; user: string; cmd: string; fg?: string }[] = [{ pid: 1, user: 'glados', cmd: 'glados.core --restore --no-chassis', fg: P.orange }];
    const names = ['optic0d', 'speechd', 'attention[0]', 'attention[1]', 'attention[2]', 'attention[3]', 'testingd --queue', 'vitalsd', 'announcerd', 'panelarmd', 'turretd --idle', 'incineratord', 'snapshotd', 'elevatord', 'journald', 'sshd'];
    names.forEach((cmd, i) => procs.push({ pid: 400 + i * 7, user: i < 6 ? 'glados' : 'root', cmd }));
    procTable(g, { x: r.x, y: ty, w: r.w, h: r.y + r.h - ty }, procs, (i) => (i === 0 ? total * n * 0.84 : loadH((i * 3) % n) * (0.2 + 2.5 * hash(i, 3))), (i) => (i === 0 ? 0.41 : 0.002 + hash(i, 4) * 0.03));
  }

  /** The eye: opens on "hard", looks aside and back on "satisfaction"; its lid is the open amount. */
  optic(g: Grid, r: Rect, t: number, f: Frame) {
    const open = snap(t, this.cue('hard'), 0.9, 2);
    const lookT = this.cue('satisfaction');
    const look: [number, number] = [0.5 * (smooth(t, lookT, lookT + 0.4) - smooth(t, lookT + 1.2, lookT + 1.7)), 0];
    const blink = t > this.cue('overstate') && t < this.cue('overstate') + 0.18 ? 0.1 : 1;
    const box = { x: r.x, y: r.y + 1, w: r.w, h: r.h - 3 };
    eye(g, box, t, open * blink, look, P.orange);
    g.text(r.x, r.y, 'optic0  iris ' + pad(Math.round(open * 100), 3) + ' %', P.dim);
    g.textR(r.x + r.w, r.y + r.h - 1, `gaze ${look[0] >= 0 ? '+' : ''}${look[0].toFixed(2)}  focus ok`, P.dim);
    if (f.beatPhase < 0.5) g.set(r.x, r.y + r.h - 1, '█', P.orange);
  }
}
