// jobs · 0:24.7–0:35.5 · we do what we must, and the ones who are dead. A job table dispatches one job
// per sung word and the screen tiles into a log pane per job; then a `who` table of hundreds of test
// subjects scrolls in, and from "except" a kill runs: one subject struck and one job pane closed per
// beat, until on "dead" a single pane is left.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, snap, hash, held, type Rect } from '../term/grid';
import { split, stripGrow, type Node, type Pane } from '../term/layout';
import { logPane, gelPlant, vitalsWall, isSurvivor, type LogLine } from '../term/widgets';
import { JOBS, FILES, subjectId } from '../term/words';
import { drawWire, turret, cube, chamber, panelWall, bounce, addModel, addPolyline, addBox, model, type Model } from '../term/wire';

export default class Jobs extends Term {
  logs: LogLine[][] = [];
  who: string[][] = [];
  models: Record<number, Model> = { 2: turret(1), 5: Jobs.storageCube(), 6: chamber() };
  /** A weighted storage cube: the box and its corner plates, nothing on the faces. */
  static storageCube(): Model {
    const m = model();
    addBox(m, [-0.6, -0.6, -0.6], [0.6, 0.6, 0.6]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) addPolyline(m, [[sx * 0.4, sy * 0.6, sz * 0.6], [sx * 0.6, sy * 0.6, sz * 0.4], [sx * 0.6, sy * 0.4, sz * 0.6]], true);
    return m;
  }

  override init() {
    for (let j = 0; j < 8; j++) {
      const t0 = this.cue(`w${j}`);
      const lines: LogLine[] = [];
      for (let k = 0; k < 80; k++) {
        const msgs = [`${JOBS[j]}: step ${k * 4}`, `read ${FILES[Math.floor(hash(j, k, 1) * FILES.length)]}`, `write ok (${Math.floor(hash(j, k, 2) * 9000)} B)`, `panel ${Math.floor(hash(j, k, 3) * 400)} seated`, `latency ${(hash(j, k, 4) * 12).toFixed(1)} ms`, `queue ${Math.floor(hash(j, k, 5) * 30)}`];
        lines.push({ t: t0 + 0.1 + k * (0.12 + 0.1 * hash(j, k, 6)), text: `${pad(k, 3)} ${msgs[Math.floor(hash(j, k, 7) * msgs.length)]}`, fg: k % 7 === 3 ? P.fg : P.dim });
      }
      this.logs.push(lines);
    }
    for (let i = 0; i < 400; i++) this.who.push([subjectId(Math.floor(hash(i, 11) * 9000) + 100), `pts/${i % 64}`, `2026-10-${pad(1 + Math.floor(hash(i, 12) * 19), 2, '0')} ${pad(Math.floor(hash(i, 13) * 24), 2, '0')}:${pad(Math.floor(hash(i, 14) * 60), 2, '0')}`, `(chamber-${pad(1 + Math.floor(hash(i, 15) * 19), 2, '0')})`]);
  }

  override frame(f: Frame): TermFrame {
    const t = f.t, cue = (n: string) => this.cue(n);
    const tExcept = cue('except'), tDead = cue('dead');
    const killsDone = t < tExcept ? 0 : Math.min(8, Math.floor((t - tExcept) / this.beatP) + 1);
    const table: Pane = { title: '1:jobs', draw: (g, r) => this.table(g, r, t, f) };
    const who: Pane = { title: '2:vitals  all subjects', draw: (g, r) => this.vitals(g, r, t, f) };
    // one log pane per job, each sliding in as its job is dispatched and out as it is killed
    const panes: Node[] = [], grow: number[] = [];
    for (let j = 0; j < 8; j++) {
      const open = snap(t, cue(`w${j}`), 0.4) - (killsDone > j ? snap(t, tExcept + j * this.beatP, 0.35) : 0);
      if (open <= 0.02) continue;
      const art = j === 1 || j === 2 || j === 4 || j === 5 || j === 6;
      panes.push({ title: `${j + 3}:${JOBS[j]}`, fg: killsDone > j ? P.orange : P.dim, draw: (g, r) => art ? this.art(g, r, j, t, f, killsDone > j) : logPane(g, r, this.logs[j]!, t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 }) });
      grow.push(open);
    }
    const openWho = snap(t, cue('for') - 0.3, 0.5);
    const left: Node = openWho > 0 ? split('v', 1 - 0.62 * openWho, table, who) : table;
    if (panes.length === 0) return { root: left };
    const rows = panes.length > 4 ? [panes.slice(0, 4), panes.slice(4)] : [panes];
    const grows = panes.length > 4 ? [grow.slice(0, 4), grow.slice(4)] : [grow];
    const rowNodes = rows.map((r, i) => stripGrow('h', r, grows[i]!));
    const rowGrow = grows.map((gs) => Math.max(...gs));
    const right: Node = rowNodes.length > 1 ? stripGrow('v', rowNodes, rowGrow) : rowNodes[0]!;
    const total = grow.reduce((a, b) => a + b, 0) / 8;
    return { root: split('h', 1 - 0.68 * Math.min(1, total * 1.5), left, right) };
  }

  /** A job's picture: the panel wall flipping panel by panel, a turret turning, a cube dropping on the beat, the chamber turning. */
  art(g: Grid, r: Rect, j: number, t: number, f: Frame, killed: boolean) {
    const t0 = this.cue(`w${j}`), fg = killed ? P.orange : P.fg;
    const box = { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 };
    if (j === 1) {
      const wall = panelWall(6, 4, (i, k) => { const ph = ((t - t0) * 1.5 - (i + k) * 0.25) % 2; return ph > 0 && ph < 1 ? Math.PI * (1 - Math.cos(ph * Math.PI)) / 2 : 0; });
      drawWire(g, box, wall, { yaw: 0.35 + 0.1 * Math.sin((t - t0) * 0.5), pitch: 0.2, dist: 3.4, focal: 1.6 }, fg);
      g.text(r.x, r.y, `panels seated ${pad(Math.min(24, Math.floor((t - t0) * 3)), 2)}/24`, P.dim);
    } else if (j === 2) {
      drawWire(g, box, this.models[2]!, { yaw: (t - t0) * 0.9, pitch: 0.15, dist: 3.4, focal: 1.5 }, fg);
      g.text(r.x, r.y, `turret ${pad(Math.floor((t - t0) * 2) % 12, 2)}  sightline ${Math.sin((t - t0) * 0.9) > 0 ? 'clear' : 'blocked'}`, P.dim);
    } else if (j === 5) {
      // the dispenser: a cube drops every two bars, bounces to rest on the floor, then slides off to the right; three in the cycle
      const period = 4 * this.beatP, cycle = 3 * period;
      const scene = model();
      // the belt: its edges and its slats, which move with it
      addPolyline(scene, [[-1.6, -0.9, -0.8], [2.2, -0.9, -0.8], [2.2, -0.9, 0.8], [-1.6, -0.9, 0.8]], true);
      for (let k = 0; k < 8; k++) { const sx = -1.6 + ((k * 0.5 + (t - t0) * 1.0) % 3.8); addPolyline(scene, [[sx, -0.9, -0.8], [sx, -0.9, 0.8]]); }
      addPolyline(scene, [[-1.5, 1.6, -0.6], [-0.3, 1.6, -0.6], [-0.3, 1.6, 0.6], [-1.5, 1.6, 0.6]], true);   // the hatch
      let dispensed = 0;
      for (let k = 0; k < 3; k++) {
        const tk = (t - t0 + 2 * cycle - k * period) % cycle;              // time since this cube's drop
        if (t - t0 - k * period < 0) continue;
        dispensed++;
        const b = bounce(tk, 1.9, 7, 0.5);
        const t1 = Math.sqrt(2 * 1.9 / 7);                                  // the first touch: the belt carries it from then on
        const slide = Math.max(0, tk - t1) * 1.0;
        if (slide > 3.4) continue;
        const x = -0.9 + slide, y = -0.9 + 0.57 + b.h, spin = b.done ? 0 : tk * 1.3;
        addModel(scene, this.models[5]!, (p) => { const q: [number, number, number] = [p[0] * 0.95, p[1] * 0.95, p[2] * 0.95]; const c = Math.cos(spin), s = Math.sin(spin); return [x + q[0] * c - q[2] * s, y + q[1], q[0] * s + q[2] * c]; });
      }
      drawWire(g, box, scene, { yaw: 0.5, pitch: 0.28, dist: 4.4, focal: 1.5 }, fg);
      g.text(r.x, r.y, `dispensed ${pad(Math.floor((t - t0) / period) + 1, 2)}  here ${dispensed}`, P.dim);
    } else if (j === 4) {
      gelPlant(g, r, t, held(t, 1));
    } else {
      drawWire(g, box, this.models[6]!, { yaw: 0.6 + (t - t0) * 0.3, pitch: 0.35, dist: 4.0, focal: 1.7 }, fg);
      g.text(r.x, r.y, `chamber 19  elevator ${Math.floor((t - t0) * 0.5) % 2 ? 'up' : 'down'}`, P.dim);
    }
  }

  table(g: Grid, r: Rect, t: number, f: Frame) {
    const cue = (n: string) => this.cue(n);
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ jobs -l', P.dim);
    g.text(r.x, r.y + 1, padR(`${padR('JOB', 5)}${padR('PID', 7)}${padR('STATE', 9)}${padR('NAME', 20)}SINCE`, r.w), P.bg, P.dim);
    const tExcept = cue('except');
    for (let j = 0; j < 8; j++) {
      const t0 = cue(`w${j}`);
      if (t < t0) break;
      const killed = t >= tExcept + j * this.beatP;
      const state = killed ? 'Killed' : 'Running';
      g.text(r.x, r.y + 2 + j, `${padR('[' + (j + 1) + ']', 5)}${padR(String(5100 + j * 13), 7)}${padR(state, 9)}${padR(JOBS[j]!, 20)}00:00:${pad(Math.floor(t0), 2, '0')}`, killed ? P.orange : P.fg);
    }
    const n = Math.min(8, [0, 1, 2, 3, 4, 5, 6, 7].filter((j) => t >= cue(`w${j}`)).length);
    if (f.beatPhase < 0.5) g.set(r.x, r.y + 2 + n, '█', P.orange);
  }

  /** The roster's vitals: 96 traces pulsing; on the beats of "except the ones who are dead" they flatline in four waves, left to right, all but the few survivors. */
  vitals(g: Grid, r: Rect, t: number, f: Frame) {
    const tExcept = this.cue('except'), tDead = this.cue('dead');
    const beats = this.beatsIn(tExcept - 0.05, tDead + 0.3);
    const cols = Math.max(2, Math.floor(r.w / 14)), rows = Math.max(1, Math.floor((r.h - 1) / 3)), n = cols * rows;
    const life = (i: number) => {
      if (isSurvivor(i)) return { born: -1, died: Infinity };
      const wave = Math.min(beats.length - 1, Math.floor(hash(i, 41) * beats.length));
      return { born: -1, died: (beats[wave] ?? tDead) + hash(i, 42) * 0.35 };
    };
    const counts = vitalsWall(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, t, n, cols, life, (i) => subjectId(Math.floor(hash(i, 11) * 9000) + 100));
    const a = counts?.alive ?? n, d = counts?.dead ?? 0;
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ vitals --all', P.dim);
    g.textR(r.x + r.w, r.y, `alive ${pad(a, 3)}   dead ${pad(d, 3)}`, d > 0 ? P.orange : P.dim);
    if (f.beatPhase < 0.5 && t >= tExcept) g.set(r.x + 33, r.y, '█', P.orange);
  }

  whoPane(g: Grid, r: Rect, t: number, f: Frame, kills: number) {
    const t0 = this.cue('for'), tExcept = this.cue('except');
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ who | wc -l; who', P.dim);
    const printed = Math.min(this.who.length, Math.floor((t - t0) * 60));
    g.text(r.x, r.y + 1, String(this.who.length), P.fg);
    const h = r.h - 2;
    const first = Math.max(0, printed - h);
    for (let i = first; i < printed; i++) {
      const row = this.who[i]!, y = r.y + 2 + (i - first);
      // the kills: from "except", one subject per beat near the bottom of the list is struck
      const killIdx = (k: number) => printed - 1 - k * 3;
      let struck = -1;
      for (let k = 0; k < kills; k++) if (killIdx(k) === i) struck = k;
      const fg = struck >= 0 ? P.orange : P.fg;
      g.text(r.x, y, `${padR(row[0]!, 14)}${padR(row[1]!, 8)}${padR(row[2]!, 18)}${row[3]}`, struck >= 0 ? P.orange : i % 9 === 0 ? P.fg : P.dim);
      if (struck >= 0) g.textR(r.x + r.w, y, `kill -9  ${pad(Math.floor(hash(i, 21) * 30000), 5)}  `, fg);
    }
    if (t >= tExcept && f.beatPhase < 0.5) g.set(r.x, r.y + 2 + Math.min(h, printed), '█', P.orange);
  }
}
