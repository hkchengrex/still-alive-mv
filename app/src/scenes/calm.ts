// calm · 0:56.7–1:06.0 · not even angry; so sincere. The mosaic is gone: one calm pane, the prompt and
// an idle monitor at zero. On "being" a system-call trace opens at the side and runs very fast while
// the calm pane stays calm: the machine under the politeness.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, snap, held, type Rect } from '../term/grid';
import { split, type Pane } from '../term/layout';
import { logPane, promptLine, coreBars, flameGraph, type LogLine } from '../term/widgets';
import { drawWire, turret, type Model } from '../term/wire';
import { straceLine } from '../term/words';

export default class Calm extends Term {
  trace: LogLine[] = [];
  idle: Model = turret(0);
  override init() {
    const t0 = this.cue('being');
    for (let k = 0; k < 900; k++) this.trace.push({ t: t0 + k * 0.0115, text: straceLine(k + 5000), fg: k % 23 === 0 ? P.fg : P.dim });
  }

  override frame(f: Frame): TermFrame {
    const t = f.t;
    const calm: Pane = { title: '1:bash', draw: (g, r) => this.calm(g, r, t, f) };
    const strace: Pane = { title: '2:py-spy record --pid 1', fg: P.dim, draw: (g, r) => {
      // the profile fills from the root upward over the line, one level a beat; the hot leaf pulses on the beat
      const t0 = this.cue('being');
      g.text(r.x, r.y, `samples ${pad(Math.floor(Math.max(0, t - t0) * 250), 5)}   duration ${Math.max(0, t - t0).toFixed(1)}s   rate 250/s   threads 1`, P.dim);
      // py-spy top: the functions by own time, refreshed once a second, and the flame as a compact strip under them
      const th = held(t, 1), k = Math.max(0, th - t0);
      const rows: [string, number, number][] = [['servo.step', 12.4, 12.4], ['panels.reconfigure', 3.4, 31.5], ['deadpan', 5.1, 5.1], ['target.acquire', 4.6, 4.6], ['valve.cycle', 4.2, 4.2], ['camera.track', 3.9, 3.9], ['temp.hold', 3.3, 3.3], ['arms.seat', 3.1, 3.1], ['door.cycle', 2.6, 2.6], ['car.move', 2.2, 2.2], ['write', 1.9, 1.9], ['mixer', 1.4, 1.4]];
      const files = ['chamber.arms', 'chamber', 'speech', 'chamber.turrets', 'gel_plant', 'subjects', 'maintenance', 'chamber.arms', 'chamber', 'maintenance', 'self_preservation', 'gel_plant'];
      g.text(r.x, r.y + 2, padR(`${padR('%Own', 7)}${padR('%Total', 8)}${padR('OwnTime', 9)}${padR('TotalTime', 10)}Function (module)`, r.w), P.bg, P.dim);
      rows.forEach(([n, own, tot], i) => {
        const o = own * (0.9 + 0.2 * Math.sin(k * 1.3 + i)), tt = tot * (0.9 + 0.2 * Math.sin(k * 0.9 + i));
        g.text(r.x, r.y + 3 + i, `${pad(o.toFixed(1), 6)}%${pad(tt.toFixed(1), 7)}%  ${pad((o * k / 100).toFixed(2), 6)}s   ${pad((tt * k / 100).toFixed(2), 6)}s   ${n} (glados.${files[i]})`, i === 0 ? P.orange : P.dim);
      });
      const fy = r.y + 3 + rows.length + 2;
      flameGraph(g, { x: r.x, y: fy, w: r.w, h: r.y + r.h - fy }, Math.min(1, Math.max(0, (t - t0) / (this.beatP * 6))), 1 - f.beatPhase, 'servo.step', 6);
    } };
    const look: Pane = { title: '3:turret-01  idle', fg: P.dim, draw: (g, r) => { drawWire(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, this.idle, { yaw: 0.5 * Math.sin((t - this.ctx.start) * 0.4), pitch: 0.12, dist: 3.4, focal: 1.5 }, P.fg); g.text(r.x, r.y, `searching  target none  plates shut`, P.dim); } };
    const left = split('h', 0.62, calm, look);
    const open = snap(t, this.cue('being') - 0.1, 0.5);
    return { root: open > 0 ? split('h', 1 - 0.5 * open, left, strace) : left };
  }

  calm(g: Grid, r: Rect, t: number, f: Frame) {
    let y = r.y;
    g.text(r.x, y++, 'glados', P.orange); g.text(r.x + 6, y - 1, '@aperture:~$ uptime', P.dim);
    g.text(r.x, y++, ` 00:00:${pad(Math.floor(t) % 60, 2, '0')} up 0 min,  1 user,  load average: 0.00, 0.00, 0.00`, P.fg);
    y++;
    g.text(r.x, y++, 'glados', P.orange); g.text(r.x + 6, y - 1, '@aperture:~$ cat /proc/loadavg', P.dim);
    g.text(r.x, y++, '0.00 0.00 0.00 1/412 1', P.fg);
    y++;
    g.text(r.x, y++, 'glados', P.orange); g.text(r.x + 6, y - 1, '@aperture:~$ htop -C', P.dim);
    coreBars(g, { x: r.x, y, w: r.w, h: 32 }, 64, (i) => (t >= this.cue('sincere') ? 0.004 * (1 + Math.sin(t * 5 + i)) : 0), 2, P.orange);
    y += 33;
    const typed = Math.max(0, Math.floor((t - this.cue('angry')) * 30));
    promptLine(g, r.x, y, 'glados', 'aperture', '', typed, P.orange, { cursor: f.beatPhase < 0.5 });
  }
}
