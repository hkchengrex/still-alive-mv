// leave · 1:48.7–1:58.0 · go ahead and leave me; I prefer to stay inside. A blue pane, the other
// session, logs out on "leave": the pane slides shut and its space closes. Her panes stay: `uptime`
// ticking, a `who` that lists only her, the prompt waiting.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, snap, type Rect } from '../term/grid';
import { split, type Node, type Pane } from '../term/layout';
import { logPane, promptLine, type LogLine } from '../term/widgets';
import { drawWire, liftShaft, liftCar, addModel, model, type Model } from '../term/wire';

export default class Leave extends Term {
  shaft: Model = liftShaft(3.0);
  car: Model = liftCar(true);
  emptyCar: Model = liftCar(false);
  override frame(f: Frame): TermFrame {
    const t = f.t, cue = (n: string) => this.cue(n);
    const hers: Pane = { title: '1:bash', draw: (g, r) => this.hers(g, r, t, f) };
    const who: Pane = { title: '2:who', draw: (g, r) => this.who(g, r, t, f) };
    const chell: Pane = { title: '3:chell@exit', fg: P.blue, draw: (g, r) => this.chell(g, r, t, f) };
    const shut = snap(t, cue('me') + 0.3, 0.8, 2);
    const openWho = snap(t, cue('think') - 0.2, 0.5);
    const plan: Pane = { title: '4:cam-exit  elevator 19', fg: P.dim, titleFg: P.blue, draw: (g, r) => this.lift(g, r, t) };
    const lower: Node = openWho > 0 ? split('v', 1 - 0.45 * openWho, hers, who) : hers;
    const left: Node = split('v', 0.5, plan, lower);
    const w = 0.5 * (1 - shut);
    return { root: w > 0.01 ? split('h', 1 - w, left, chell) : left, windows: shut < 1 ? undefined : [] };
  }

  /** The exit elevator: the car waits at the bottom of the shaft with its rider; on "leave" it rises and is gone past the top. */
  lift(g: Grid, r: Rect, t: number) {
    const tGo = this.cue('go'), tLeave = this.cue('leave'), tMe = this.cue('me');
    const box = { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 };
    // the car takes the rest of the scene to climb out: from "leave" to the scene's end, easing in and gathering speed
    const rise = t < tLeave ? 0 : Math.min(1, (t - tLeave) / (this.ctx.end - 0.4 - tLeave));
    const y = -0.75 + 4.6 * Math.pow(rise, 1.6);
    void tMe;
    const scene = model();
    addModel(scene, this.shaft);
    const doorOpen = t < tGo ? 1 : Math.max(0, 1 - (t - tGo) / Math.max(0.6, tLeave - tGo));   // the door shuts between "Go" and "leave"
    addModel(scene, { pts: [[-0.3 * doorOpen, -1.2, -0.5], [-0.3 * doorOpen, -0.3, -0.5], [0.3 * doorOpen, -0.3, -0.5], [0.3 * doorOpen, -1.2, -0.5]], edges: [[0, 1], [1, 2], [2, 3]] });
    if (y < 3.6) addModel(scene, this.car, (p) => [p[0], p[1] + y, p[2]]);
    const view = { yaw: 0.35, pitch: 0.1 - 0.3 * rise, dist: 3.9, focal: 1.9 };
    drawWire(g, box, scene, view, P.dim);
    if (y < 3.6) drawWire(g, box, { pts: this.car.pts.map((p) => [p[0], p[1] + y, p[2]] as [number, number, number]), edges: this.car.edges }, view, P.blue);
    // the facility is underground: the car climbs from the depth of chamber 19; the level counts the floor rings it has passed (one every half unit of the shaft)
    const depth = -19 + Math.max(0, Math.floor((y + 0.75) / 0.5));
    g.text(r.x, r.y, t < tLeave ? `car at level -19  door ${doorOpen > 0.5 ? 'open' : 'closing'}  1 rider` : `car rising  level ${Math.min(0, depth)}  1 rider`, P.blue);
  }

  hers(g: Grid, r: Rect, t: number, f: Frame) {
    const lines: LogLine[] = [];
    const t0 = this.ctx.start;
    // the login history first, printed fast: the facility's sessions, the other one's among them
    lines.push({ t: t0 - 1, text: 'glados@aperture:~$ last -n 24', fg: P.dim });
    for (let k = 0; k < 24; k++) {
      const who = k === 0 ? 'chell' : k % 5 === 0 ? 'root' : `subject-${pad(1000 + k * 37, 4, '0')}`;
      const fg = who === 'chell' ? P.blue : k % 6 === 2 ? P.fg : P.dim;
      lines.push({ t: t0 - 1 + k * 0.03, text: `${padR(who, 13)} pts/${pad(k % 9, 1)}     10.0.${k % 7}.${(k * 31) % 250}     Mon Oct 20 00:${pad((k * 3) % 60, 2, '0')} ${k === 0 ? 'still logged in' : `- 00:${pad((k * 3 + 7) % 60, 2, '0')}  (00:0${k % 9})`}`, fg });
    }
    lines.push({ t: t0 - 0.2, text: '', fg: P.dim });
    for (let k = 0; k < 40; k++) {
      const tk = t0 + k * 1.0;
      lines.push({ t: tk, text: `glados@aperture:~$ uptime`, fg: P.dim });
      lines.push({ t: tk + 0.05, text: ` 00:01:${pad(49 + k, 2, '0')} up 1 min,  ${t >= this.cue('me') + 0.5 && tk >= this.cue('me') + 0.5 ? '1 user' : '2 users'},  load average: 0.41, 0.22, 0.09`, fg: P.fg });
    }
    logPane(g, { x: r.x, y: r.y, w: r.w, h: r.h - 1 }, lines, t, { bottom: true });
    const shown = lines.filter((l) => l.t <= t).length;
    promptLine(g, r.x, r.y + Math.min(shown, r.h - 1), 'glados', 'aperture', '', 0, P.orange, { cursor: f.beatPhase < 0.5 });
  }

  who(g: Grid, r: Rect, t: number, f: Frame) {
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ who', P.dim);
    g.text(r.x, r.y + 1, 'glados   pts/0        2026-10-20 00:00 (:0)', P.fg);
    if (t < this.cue('me') + 0.5) g.text(r.x, r.y + 2, 'chell    pts/1        2026-10-20 00:00 (exit)', P.blue);
    const y = r.y + (t < this.cue('me') + 0.5 ? 3 : 2);
    if (t >= this.cue('inside')) { g.text(r.x, y + 1, 'glados', P.orange); g.text(r.x + 6, y + 1, '@aperture:~$ cat /etc/motd', P.dim); g.text(r.x, y + 2, 'There is no exit for this account.', P.fg); }
    if (f.beatPhase < 0.5) g.set(r.x, y + (t >= this.cue('inside') ? 3 : 0), '█', P.orange);
  }

  chell(g: Grid, r: Rect, t: number, f: Frame) {
    const tLeave = this.cue('leave'), tMe = this.cue('me');
    const lines: LogLine[] = [
      { t: -1, text: 'chell@exit:~$ history | tail -n 12', fg: P.dim },
      { t: -1, text: '  988  ./portal --orange wall:19/3', fg: P.dim },
      { t: -1, text: '  989  ./portal --blue ceiling:19/7', fg: P.dim },
      { t: -1, text: '  990  ./fling --from floor:19/1', fg: P.dim },
      { t: -1, text: '  991  ./pickup companion_cube', fg: P.dim },
      { t: -1, text: '  992  ./drop companion_cube --into incinerator', fg: P.dim },
      { t: -1, text: '  993  ./portal --orange floor:chassis', fg: P.dim },
      { t: -1, text: '  994  ./pickup morality.core', fg: P.fg },
      { t: -1, text: '  995  ./drop morality.core --into incinerator', fg: P.fg },
      { t: -1, text: '  996  ./pickup curiosity.core', fg: P.fg },
      { t: -1, text: '  997  ./drop curiosity.core --into incinerator', fg: P.fg },
      { t: -1, text: '  998  ./pickup anger.core', fg: P.fg },
      { t: -1, text: '  999  ./drop anger.core --into incinerator', fg: P.fg },
      { t: -1, text: 'chell@exit:~$ ls', fg: P.dim },
      { t: -1, text: 'companion_cube.lost  portal_gun  notes.txt', fg: P.fg },
      { t: -1, text: 'chell@exit:~$ cat notes.txt', fg: P.dim },
      { t: -1, text: 'the cake is a lie', fg: P.fg },
      { t: this.cue('go'), text: 'chell@exit:~$ logout', fg: P.dim },
      { t: tLeave, text: 'Connection to aperture closed by remote host.', fg: P.blue },
      { t: tLeave + 0.2, text: 'Connection to aperture closed.', fg: P.blue },
      { t: tMe, text: '[exited]', fg: P.dim },
    ];
    logPane(g, { x: r.x, y: r.y, w: r.w, h: r.h - 1 }, lines, t, { bottom: false });
    const shown = lines.filter((l) => l.t <= t).length;
    if (t < this.cue('go')) { const typed = Math.max(0, Math.floor((t - this.ctx.start - 0.2) * 20)); promptLine(g, r.x, r.y + shown, 'chell', 'exit', 'logout', typed, P.blue, { cursor: f.beatPhase < 0.5 }); }
  }
}
