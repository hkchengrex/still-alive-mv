// reactor · 2:39.4–2:43.4 · I'm doing science and I'm still alive. The facility's reactor is in meltdown: the core
// temperature climbs, the pressure with it, a SCRAM fails because the control rods are jammed, the alarm log counts
// down on the beats; on "still" she overrides it, the rods drop and the vent opens, and on "alive" the core cools and
// the log reads that science has resumed.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, smooth, hash, held, type Rect } from '../term/grid';
import { split, type Pane } from '../term/layout';
import { bar, linePlot, logPane, type LogLine } from '../term/widgets';

const HOT = '#F0A050';   // the core's hottest glow, between orange and pale

export default class Reactor extends Term {
  alarms: LogLine[] = [];

  /** The core's temperature (K) over the scene: climbing to the override, falling after it. */
  temp(t: number) {
    const t0 = this.ctx.start, tS = this.cue('still'), tA = this.cue('alive');
    if (t < tS) { const u = Math.max(0, (t - t0) / (tS - t0)); return 2400 + 2600 * u * u; }
    const peak = 5000;
    return peak - (peak - 1900) * smooth(t, tS, tA + 0.9);
  }
  /** How far the control rods are in: jammed a fifth of the way until the override, then dropped. */
  rods(t: number) { return 0.2 + 0.8 * smooth(t, this.cue('still'), this.cue('still') + 0.5); }
  vent(t: number) { return smooth(t, this.cue('still') + 0.2, this.cue('still') + 0.6); }

  override init() {
    const t0 = this.ctx.start, tS = this.cue('still'), tA = this.cue('alive');
    const A = (t: number, s: string, fg: string = P.dim) => this.alarms.push({ t, text: s, fg });
    A(t0 - 1, 'reactor-01  alarm log  (follow)');
    A(t0 + 0.05, 'ALARM  core temperature 2400 K and rising', P.orange);
    A(t0 + 0.25, 'ALARM  primary pressure 14.2 MPa', P.orange);
    A(t0 + 0.45, 'coolant pump 2: offline (power loss, incident 0001)');
    A(t0 + 0.7, 'SCRAM requested by safety.core', P.fg);
    A(t0 + 0.95, 'SCRAM FAILED  control rods jammed at 20 %  (chassis damage)', P.orange);
    A(t0 + 1.2, 'containment: 96 %', P.fg);
    const beats = this.beatsIn(t0 + 1.0, tS);
    beats.forEach((b, i) => A(b, `MELTDOWN IN  00:0${Math.max(1, beats.length - i)}`, P.orange));
    A(tS, 'override  glados.core  --force', P.fg);
    A(tS + 0.15, 'control rods: manual drop', P.fg);
    A(tS + 0.3, 'vent: open to atmosphere', P.fg);
    A(tA, 'core temperature falling', P.fg);
    A(tA + 0.3, 'reactor stable.  science resumed.', P.orange);
  }

  override frame(f: Frame): TermFrame {
    const t = f.t;
    const diagram: Pane = { title: '1:reactor-01  core', fg: this.temp(t) > 4200 && f.beatPhase < 0.5 ? P.orange : P.dim, titleFg: P.orange, draw: (g, r) => this.diagram(g, r, t, f) };
    const gauges: Pane = { title: '2:gauges', draw: (g, r) => this.gauges(g, r, t) };
    const log: Pane = { title: '3:alarms', draw: (g, r) => logPane(g, r, this.alarms, t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 }) };
    return { root: split('h', 0.56, diagram, split('v', 0.55, gauges, log)) };
  }

  /** The reactor as a plant diagram: containment, the vessel with its fuel and control rods, the coolant loop, the pump and exchanger, the vent stack. */
  diagram(g: Grid, r: Rect, t: number, f: Frame) {
    const T = this.temp(t), rods = this.rods(t), vent = this.vent(t);
    const hot = (T - 1900) / 3100;                                     // 0 cool .. 1 meltdown
    const critical = T > 4200;
    const flicker = critical && hash(Math.floor(t * 20), 1) < 0.5;
    // containment
    const cx = r.x + 2, cy = r.y + 1, cw = Math.min(r.w - 4, 70), ch = r.h - 3;
    g.box({ x: cx, y: cy, w: cw, h: ch }, critical && f.beatPhase < 0.5 ? P.orange : P.dim);
    g.text(cx + 2, cy, ' CONTAINMENT ', critical ? P.orange : P.dim);
    // the vessel: a tall box left of centre
    const vw = Math.floor(cw * 0.42), vh = ch - 8, vx = cx + 4, vy = cy + 4;
    const glow = hot < 0.35 ? null : hot < 0.7 ? P.orangeDim : '#8A3A14';
    g.fillBg({ x: vx + 1, y: vy + 1, w: vw - 2, h: vh - 2 }, glow);
    g.box({ x: vx, y: vy, w: vw, h: vh }, P.fg);
    g.text(vx + 2, vy + vh - 1, ' VESSEL ', P.fg);
    // fuel rods: columns of blocks; control rods in the gaps, from the top, by `rods`
    const nFuel = Math.max(3, Math.floor((vw - 4) / 4));
    for (let k = 0; k < nFuel; k++) {
      const x = vx + 2 + k * 4;
      for (let y = vy + 2; y < vy + vh - 2; y++) {
        const u = (y - vy - 2) / (vh - 4);
        const hotHere = hot > 0.5 + 0.4 * Math.abs(u - 0.5) * 2 - 0.4;
        g.set(x, y, '█', flicker && hotHere ? HOT : hotHere ? P.orange : hot > 0.2 ? P.orangeDim : P.dim);
        g.set(x + 1, y, '█', flicker && hotHere ? HOT : hotHere ? P.orange : hot > 0.2 ? P.orangeDim : P.dim);
      }
      if (k < nFuel - 1) {
        const rx = x + 3, depth = Math.round(rods * (vh - 4));
        for (let y = vy + 2; y < vy + 2 + depth && y < vy + vh - 2; y++) g.set(rx, y, '▓', P.fg);
        g.set(rx, vy, '┬', P.fg);                                    // the rod's drive at the head
      }
    }
    // the rod state under the vessel
    g.text(vx, vy + vh, `rods ${pad(Math.round(rods * 100), 3)}%  ${rods < 0.5 ? 'JAMMED' : rods < 1 ? 'dropping' : 'in'}`, rods < 0.5 ? P.orange : P.fg);
    g.text(vx, vy + vh + 1, `core ${pad(Math.round(T), 4)} K`, critical ? P.orange : P.fg);
    // the coolant loop: out of the vessel's right side, up to the exchanger, back along the bottom through the pump
    const lx0 = vx + vw, hxX = cx + cw - 16, hxY = vy + 2, pumpY = vy + vh - 4;
    g.hline(lx0, hxX, hxY + 1, P.dim);
    g.box({ x: hxX, y: hxY, w: 12, h: 4 }, P.dim); g.text(hxX + 2, hxY + 1, 'EXCHANGER', P.fg); g.text(hxX + 2, hxY + 2, `${pad(Math.round(T * 0.18), 3)} K out`, P.dim);
    g.vline(hxX + 6, hxY + 4, pumpY, P.dim);
    g.box({ x: hxX - 2, y: pumpY, w: 10, h: 3 }, P.dim); g.text(hxX, pumpY + 1, 'PUMP 1 ' + ['|', '/', '-', '\\'][Math.floor(t * 12) % 4], P.fg);
    g.box({ x: hxX - 14, y: pumpY, w: 10, h: 3 }, P.dim2); g.text(hxX - 12, pumpY + 1, 'PUMP 2 x', P.orangeDim);
    g.hline(lx0, hxX - 2, pumpY + 1, P.dim);
    // the flow marks: fast when hot, both ways round the loop
    const ph = Math.floor(t * (6 + 10 * hot)) % 4;
    for (let x = lx0 + 1; x < hxX; x++) if ((x - lx0) % 4 === ph) g.set(x, hxY + 1, '>', P.orange);
    for (let x = hxX - 15; x > lx0; x--) if ((hxX - x) % 4 === ph) g.set(x, pumpY + 1, '<', P.blueSoft);
    for (let y = hxY + 5; y < pumpY; y++) if ((y - hxY) % 3 === ph % 3) g.set(hxX + 6, y, '▼', P.blueSoft);
    // the vent stack above the containment: steam when open
    const sx = cx + cw - 8;
    g.vline(sx, cy - 1, cy + 3, P.dim); g.set(sx, cy + 3, '┴', P.dim);
    g.text(sx - 3, cy + 4, vent > 0.5 ? 'VENT open' : 'VENT shut', vent > 0.5 ? P.fg : P.dim2);
    if (vent > 0) { const n = Math.round(vent * 3); for (let k = 0; k < n; k++) { const yy = cy - 1 - k; if (yy >= r.y) g.text(sx - 1 + (Math.floor(t * 6 + k) % 2), yy, '≈', P.fg); } }
    // the pressure and the countdown along the containment's floor
    const pr = 14.2 + 9 * hot - 12 * vent;
    g.text(cx + 2, cy + ch - 2, `pressure ${pad(pr.toFixed(1), 5)} MPa  containment ${pad(Math.round(96 + 20 * hot - 24 * vent), 3)} %`, pr > 18 ? P.orange : P.dim);
    const tS = this.cue('still');
    if (t < tS) { const left = Math.max(0, Math.ceil((tS - t) / this.beatP)); g.textR(cx + cw - 2, cy + ch - 2, `MELTDOWN IN 00:0${left}`, f.beatPhase < 0.5 ? P.orange : P.fg); }
    else g.textR(cx + cw - 2, cy + ch - 2, t < this.cue('alive') ? 'OVERRIDE  glados.core' : 'STABLE', t < this.cue('alive') ? P.orange : P.fg);
  }

  /** The gauges: the temperature curve over the scene, and bars for pressure, neutron flux and coolant flow, refreshed four times a second. */
  gauges(g: Grid, r: Rect, t: number) {
    const t0 = this.ctx.start, t1 = this.ctx.end, th = held(t, 0.25);
    const T = this.temp(th), hot = (T - 1900) / 3100, vent = this.vent(th);
    g.text(r.x, r.y, 'core temperature', P.dim); g.textR(r.x + r.w, r.y, `${pad(Math.round(T), 4)} K   limit 4200 K`, T > 4200 ? P.orange : P.dim);
    const box = { x: r.x, y: r.y + 1, w: r.w, h: Math.max(4, r.h - 7) };
    const lim = (4200 - 1900) / 3300;
    g.hline(r.x, r.x + r.w - 1, box.y + Math.round((box.h - 1) * (1 - lim)), P.orangeDim);
    linePlot(g, box, (u) => (this.temp(t0 + u * (t1 - t0)) - 1900) / 3300, T > 4200 ? P.orange : P.fg, (t - t0) / (t1 - t0));
    const y = box.y + box.h + 1, w = Math.max(10, r.w - 24);
    g.text(r.x, y, 'pressure ', P.dim); bar(g, r.x + 9, y, w, Math.min(1, (14.2 + 9 * hot - 12 * vent) / 24), hot > 0.6 ? P.orange : P.fg, ' ', P.dim2); g.textR(r.x + r.w, y, `${pad((14.2 + 9 * hot - 12 * vent).toFixed(1), 5)} MPa`, P.dim);
    g.text(r.x, y + 1, 'flux     ', P.dim); bar(g, r.x + 9, y + 1, w, Math.min(1, 0.3 + 0.7 * hot * (1 - 0.8 * (this.rods(th) - 0.2))), P.orange, ' ', P.dim2); g.textR(r.x + r.w, y + 1, `${(2.1 + 6 * hot).toFixed(1)}e13`, P.dim);
    g.text(r.x, y + 2, 'coolant  ', P.dim); bar(g, r.x + 9, y + 2, w, 0.45 + 0.1 * Math.sin(th * 3), P.blueSoft, ' ', P.dim2); g.textR(r.x + r.w, y + 2, 'pump 1 only', P.dim);
    g.text(r.x, y + 3, 'rods     ', P.dim); bar(g, r.x + 9, y + 3, w, this.rods(th), P.fg, ' ', P.dim2); g.textR(r.x + r.w, y + 3, this.rods(th) < 0.5 ? 'JAMMED' : 'in', this.rods(th) < 0.5 ? P.orange : P.dim);
  }
}
