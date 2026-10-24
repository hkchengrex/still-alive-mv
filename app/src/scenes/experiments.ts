// experiments · 2:27.6–2:35.5 · experiments to run, on the people who are still alive. The job table
// fills with new experiments one per 8th; new plots start beside it; from "On" new subjects log in to
// the `who` table, one per beat.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, hash, type Rect } from '../term/grid';
import { split, type Pane } from '../term/layout';
import { bar, linePlot, table, facilityGraph, vitalsWall } from '../term/widgets';
import { drawWire, chamber, addModel, addPolyline, model, type Model } from '../term/wire';
import { JOBS, subjectId } from '../term/words';

export default class Experiments extends Term {
  room: Model = chamber();
  override frame(f: Frame): TermFrame {
    const t = f.t;
    const jobs: Pane = { title: '1:experiments', draw: (g, r) => this.jobs(g, r, t, f) };
    const plots: Pane = { title: '2:curves', draw: (g, r) => this.plots(g, r, t) };
    const graph: Pane = { title: '5:facility  links', draw: (g, r) => facilityGraph(g, r, t, Math.min(1, (t - this.cue('research')) / 3 + 0.3)) };
    const who: Pane = { title: '3:vitals  intake', draw: (g, r) => this.vitals(g, r, t, f) };
    const plan: Pane = { title: '4:cam-13  aerial faith plates', fg: P.dim, titleFg: P.blue, draw: (g, r) => this.fling(g, r, t) };
    const openWho = t >= this.cue('on') - 0.2 ? 1 : 0;
    const right = openWho ? split('v', 0.5, split('h', 0.5, graph, plan), split('h', 0.34, plots, who)) : split('v', 0.5, split('h', 0.5, graph, plan), plots);
    return { root: split('h', 0.5, jobs, right) };
  }

  jobs(g: Grid, r: Rect, t: number, f: Frame) {
    const t0 = this.cue('experiments'), dt = this.beatP / 2;
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ watch -n 0.5 squeue -u glados', P.dim);
    g.text(r.x, r.y + 1, padR(`${padR('JOBID', 7)}${padR('NAME', 26)}${padR('ST', 4)}${padR('TIME', 8)}PROGRESS`, r.w), P.bg, P.dim);
    const n = Math.min(r.h - 2, Math.max(0, Math.floor((t - t0) / dt) + 1));
    for (let i = 0; i < n; i++) {
      const started = t0 + i * dt, age = t - started;
      const name = `exp-${pad(4000 + i * 7, 4)}-${JOBS[(i * 3) % JOBS.length]}`;
      const p = Math.min(1, age / (6 + hash(i, 2) * 10));
      g.text(r.x, r.y + 2 + i, `${padR(String(91000 + i), 7)}${padR(name, 26)}${padR(age < 0.3 ? 'PD' : 'R', 4)}${padR(`0:${pad(Math.floor(age), 2, '0')}`, 8)}`, age < 0.3 ? P.orange : P.fg);
      bar(g, r.x + 45, r.y + 2 + i, Math.max(8, r.w - 52), p, P.orange, ' ', P.dim2);
      g.textR(r.x + r.w, r.y + 2 + i, `${pad(Math.round(p * 100), 3)}%`, P.dim);
    }
    if (f.beatPhase < 0.5) g.set(r.x, r.y + 2 + n, '█', P.orange);
  }

  plots(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('research');
    const n = 2, h = r.h, w = Math.floor(r.w / 2);
    for (let i = 0; i < n; i++) {
      const rr = { x: r.x + (i % 2) * w, y: r.y, w: w - 1, h: h - 1 };
      const reveal = Math.max(0, (t - t0 - i * 0.5) / 3);
      const collapse = i === 1, fallen = collapse && reveal > 0.55;
      g.textW(rr.x, rr.y, `exp-${pad(4000 + i * 7, 4)}${fallen ? ' collapsed' : ' reward'}`, rr.w, fallen ? P.orange : P.dim);
      linePlot(g, { x: rr.x, y: rr.y + 1, w: rr.w, h: rr.h - 1 }, (u) => (collapse && u > 0.5 ? 0.04 + 0.03 * hash(i, Math.floor(u * 60)) : 0.15 + 0.7 * (1 - Math.exp(-u * (2 + i)))) + 0.05 * Math.sin(u * 50 + i) * hash(i, Math.floor(u * 40)), fallen ? P.orange : P.blueSoft, reveal);
    }
  }

  /**
   * The chamber from camera 13: two aerial faith plates, one at each end, and one subject flung between them, a parabola
   * every bar, landing on the far plate, which flings it back. The subject is a post with a crossbar; the plates tilt as they fire.
   */
  fling(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('experiments'), box = { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 };
    const view = { yaw: 0.2 + 0.05 * Math.sin((t - this.ctx.start) * 0.3), pitch: 0.2, dist: 4.0, focal: 1.9 };
    const per = 4 * this.beatP, T = Math.min(1.5, per * 0.7);
    const tt = Math.max(0, t - t0), k = Math.floor(tt / per), ph = tt - k * per;           // the k-th flight, ph seconds in
    const dir = k % 2 === 0 ? 1 : -1;                                                      // left to right, then back
    const scene = model();
    addModel(scene, this.room);
    for (const side of [-1, 1] as const) {
      const firing = side === -dir && ph < 0.25 ? 1 - ph / 0.25 : 0;                     // the plate that just fired tilts up
      const px = side * 1.05, tilt = 0.35 * firing;
      addPolyline(scene, [[px - 0.2, -0.68, -0.25], [px + 0.2, -0.68 + tilt * side * -1, -0.25], [px + 0.2, -0.68 + tilt * side * -1, 0.25], [px - 0.2, -0.68, 0.25]], true);
    }
    drawWire(g, box, scene, view, P.dim);
    // the subject: in flight for T seconds of each bar, then standing on the far plate until the next launch
    const rider = model();
    let x: number, y: number;
    if (t < t0) { x = -1.05; y = -0.7; }
    else if (ph < T) { const u = ph / T; x = -dir * 1.05 + dir * 2.1 * u; y = -0.7 + 4.2 * u * (1 - u); }
    else { x = dir * 1.05; y = -0.7 + 0.02 * Math.sin(t * 9); }
    addPolyline(rider, [[x, y, 0], [x, y + 0.3, 0]]);
    addPolyline(rider, [[x - 0.07, y + 0.32, 0], [x + 0.07, y + 0.32, 0]]);
    addPolyline(rider, [[x - 0.06, y, 0], [x + 0.06, y, 0]]);
    drawWire(g, box, rider, view, P.blue);
    const inFlight = t >= t0 && ph < T;
    g.text(r.x, r.y, `chamber 13  subject-0001  ${inFlight ? `in flight  ${(ph).toFixed(1)} s  apex ${(4.2 * 0.25).toFixed(1)} m` : `on plate ${dir > 0 ? 'B' : 'A'}  charging`}  flights ${t < t0 ? 0 : k + (inFlight ? 1 : 1)}`, P.blue);
  }

  /** New subjects brought in: a trace starts pulsing on every beat from "On", the wall filling. */
  vitals(g: Grid, r: Rect, t: number, f: Frame) {
    const t0 = this.cue('on');
    const cols = Math.max(2, Math.floor(r.w / 14)), rows = Math.max(1, Math.floor((r.h - 1) / 3)), n = cols * rows;
    const counts = vitalsWall(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, t, n, cols, (i) => ({ born: t0 + i * this.beatP, died: Infinity }), (i) => subjectId(434 + i * 3));
    g.text(r.x, r.y, 'intake', P.dim);
    g.textR(r.x + r.w, r.y, `alive ${pad(counts?.alive ?? 0, 3)}`, P.fg);
    if (f.beatPhase < 0.5) g.set(r.x + 7, r.y, '█', P.orange);
  }

  who(g: Grid, r: Rect, t: number, f: Frame) {
    const t0 = this.cue('on');
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ who --count', P.dim);
    const n = Math.min(r.h - 3, Math.max(0, Math.floor((t - t0) / this.beatP) + 1));
    const rows: string[][] = [];
    for (let i = 0; i < n; i++) rows.push([subjectId(434 + i * 3), `pts/${12 + i}`, `00:02:${pad(28 + i, 2, '0')}`, `(intake-${pad(1 + (i % 4), 2, '0')})`]);
    table(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 2 }, ['NAME', 'LINE', 'TIME', 'FROM'], [14, 8, 10, 12], rows, (i) => (i === n - 1 ? P.fg : P.dim));
    g.text(r.x, r.y + r.h - 1, `# users=${n + 1}`, P.dim);
    if (f.beatPhase < 0.5) g.set(r.x + 12, r.y + r.h - 1, '█', P.orange);
  }
}
