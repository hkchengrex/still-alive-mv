// mosaic · the machine running: the screen splits on every beat into a tiling of panes each doing
// something on the beat. Three modes: `machine` (break 1: logs, bars, plots, a clock, the eye small),
// `work` (L26: tests, jobs, plots refilling fast), `split` (L31: experiments splitting without end).
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, snap, hash, hhmmss, held, type Rect } from '../term/grid';
import { mosaic, type Node, type Pane } from '../term/layout';
import { logPane, sparkline, coreBars, linePlot, bar, testRun, musicLoad, gpuPane, memMap, diskMap, netPane, flameGraph, facilityGraph, gelPlant, type LogLine } from '../term/widgets';
import { drawWire, turret, addPolyline, type Model } from '../term/wire';
import { JOBS, FILES, straceLine, TESTS } from '../term/words';

type Kind = 'log' | 'bars' | 'plot' | 'clock' | 'eye' | 'tests' | 'strace' | 'spark' | 'jobs' | 'gpu' | 'mem' | 'disk' | 'net' | 'flame' | 'graph' | 'plant' | 'trace';

export default class Mosaic extends Term {
  kinds: Kind[] = [];
  logs = new Map<number, LogLine[]>();

  get mode() { return String(this.ctx.params.mode ?? 'machine'); }

  override init() {
    const order: Record<string, Kind[]> = {
      machine: ['log', 'bars', 'gpu', 'clock', 'eye', 'mem', 'flame', 'net', 'plot', 'disk', 'graph', 'spark', 'trace', 'gpu', 'plot', 'mem', 'bars', 'net', 'plant', 'disk', 'log', 'strace', 'spark', 'flame'],
      work: ['tests', 'jobs', 'plot', 'gpu', 'flame', 'mem', 'jobs', 'net', 'tests', 'graph', 'disk', 'jobs', 'trace', 'plant', 'plot', 'tests'],
      split: ['tests', 'plot', 'gpu', 'flame', 'mem', 'plot', 'tests', 'net', 'graph', 'disk', 'plot', 'tests', 'trace', 'gpu', 'tests', 'spark', 'plant', 'plot', 'mem', 'tests', 'net', 'flame', 'plot', 'disk', 'tests', 'spark', 'gpu', 'graph', 'plot', 'tests', 'mem', 'trace'],
    };
    this.kinds = order[this.mode] ?? order.machine!;
  }

  /** How many panes are open at t: one more per beat (two per beat in `split`), from the scene's start. */
  count(t: number) {
    const per = this.mode === 'split' ? 2 : 1;
    const k = Math.floor((t - this.ctx.start) / this.beatP + 0.02) * per + 1;
    return Math.max(1, Math.min(this.kinds.length, k));
  }

  override frame(f: Frame): TermFrame {
    const t = f.t;
    const n = this.count(t);
    const panes: Node[] = [];
    for (let i = 0; i < n; i++) panes.push(this.pane(i, t, f));
    const cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : n <= 25 ? 5 : 6;
    return { root: mosaic(panes, cols) };
  }

  pane(i: number, t: number, f: Frame): Pane {
    const kind = this.kinds[i]!, t0 = this.ctx.start + Math.floor(i / (this.mode === 'split' ? 2 : 1)) * this.beatP;
    const names: Record<Kind, string> = { log: 'journal', bars: 'cores', plot: 'loss', clock: 'date', eye: 'turret-07', tests: 'pytest', strace: 'strace', spark: 'load', jobs: 'jobs', gpu: 'nvidia-smi', mem: 'memmap', disk: 'defrag', net: 'iftop', flame: 'py-spy', graph: 'facility', plant: 'gel-plant', trace: 'traceback' };
    return {
      title: `${i + 1}:${names[kind]}`, fg: P.dim, titleFg: kind === 'eye' ? P.orange : undefined,
      draw: (g: Grid, r: Rect) => {
        switch (kind) {
          case 'log': { logPane(g, r, this.log(i, t0), t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 }); break; }
          case 'strace': { logPane(g, r, this.log(i, t0, true), t, { bottom: true }); break; }
          case 'bars': { const th = held(t, 1), ah = this.ctx.audio.sample(th); coreBars(g, r, Math.min(32, r.h * 2), (k) => musicLoad(f.a, k + i * 32, t, 0.3), 2, P.orange, (k) => musicLoad(ah, k + i * 32, th, 0.3)); break; }
          case 'spark': { const au = this.ctx.audio; sparkline(g, r, (tt) => Math.min(1, 0.2 + 0.4 * au.env('rms', tt) + 0.5 * au.hit('kick', tt) + 0.3 * au.hit('snare', tt)), t, 0.04, P.orange); break; }
          case 'gpu': { const th = held(t, 1); gpuPane(g, r, th, this.ctx.audio.sample(th), Math.min(8, r.h - 1), 0.35, i); break; }
          case 'mem': { memMap(g, r, t, f.beat, i, 0.6 + 0.3 * Math.min(1, (t - t0) / 6)); break; }
          case 'disk': { diskMap(g, r, t, t0, i, 40 + 20 * (i % 3)); break; }
          case 'net': { const au = this.ctx.audio; netPane(g, r, t, (n2, tt) => au.env(n2, tt), (k2, tt) => au.hit(k2, tt), i, held(t, 1)); break; }
          case 'flame': { flameGraph(g, { x: r.x, y: r.y + Math.max(0, r.h - 8), w: r.w, h: Math.min(8, r.h) }, Math.min(1, (t - t0) / 2.5), 1 - f.beatPhase, ['servo.step', 'deadpan', 'valve.cycle', 'write'][i % 4], 1); break; }
          case 'graph': { facilityGraph(g, r, t, Math.min(1, (t - t0) / 3)); break; }
          case 'plant': { gelPlant(g, r, t, held(t, 1)); break; }
          case 'trace': { logPane(g, r, this.trace(i, t0), t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 }); break; }
          case 'plot': {
            // one reward curve in every mosaic collapses: it climbs, then falls to nothing and stays there
            const collapse = this.mode !== 'machine' && i === this.kinds.indexOf('plot', 2);
            const fallen = collapse && (t - t0) / 3 > 0.62;
            g.text(r.x, r.y, this.mode === 'machine' ? 'loss' : `reward${fallen ? '  collapsed' : ''}`, fallen ? P.orange : P.dim);
            const curve = (u: number) => {
              if (this.mode === 'machine') return 0.9 - 0.7 * Math.sqrt(u);
              if (collapse && u > 0.6) return 0.04 + 0.03 * hash(i, Math.floor(u * 60));
              return 0.2 + 0.7 * Math.sqrt(u);
            };
            linePlot(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, (u) => curve(u) + 0.06 * Math.sin(u * 40 + i) * hash(i, Math.floor(u * 30)), fallen ? P.orange : P.blueSoft, Math.min(1, (t - t0) / 3));
            break;
          }
          case 'clock': {
            const s = hhmmss(t);
            g.textC(r, r.y + Math.floor(r.h / 2) - 1, 'Mon Oct 20 2026', P.dim);
            g.textC(r, r.y + Math.floor(r.h / 2), s, P.fg);
            g.textC(r, r.y + Math.floor(r.h / 2) + 1, `up ${pad(Math.floor(t), 3)} s  load ${(0.5 + 0.5 * this.ctx.audio.env('rms', held(t, 1))).toFixed(2)}`, P.dim);
            break;
          }
          case 'eye': {
            // a turret, plates open, its sight line sweeping the room and snapping to a target on the beat
            const m: Model = { pts: [...turret(1).pts], edges: [...turret(1).edges] };
            const sweep = 0.9 * Math.sin((t - t0) * 0.9);
            addPolyline(m, [[0, 0.05, -0.3], [Math.sin(sweep) * 3, 0.05 - 0.2, -Math.cos(sweep) * 3]]);
            drawWire(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, m, { yaw: 0.5 + 0.2 * Math.sin((t - t0) * 0.3), pitch: 0.2, dist: 3.8, focal: 1.5 }, f.beatPhase < 0.15 ? P.orange : P.fg);
            g.text(r.x, r.y, `turret 07  ${f.beatPhase < 0.15 ? 'TARGET' : 'searching'}  az ${(sweep * 57.3).toFixed(0).padStart(4)}`, f.beatPhase < 0.15 ? P.orange : P.dim);
            break;
          }
          case 'tests': {
            const lines: LogLine[] = [];
            for (let run = 0; run < 6; run++) lines.push(...testRun(t0 + run * 2.0, 0.12, (k) => hash(i, run, k) < 0.25, `$ pytest -q  # run ${run + 1 + i}`, 10));
            logPane(g, r, lines, t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 });
            break;
          }
          case 'jobs': {
            g.text(r.x, r.y, padR(`${padR('JOB', 5)}${padR('STATE', 9)}NAME`, r.w), P.bg, P.dim);
            for (let k = 0; k + 1 < r.h && k < 12; k++) {
              const on = t >= t0 + k * 0.25;
              if (!on) break;
              const name = JOBS[(i * 5 + k) % JOBS.length]!, run = Math.sin(t * 2 + k + i) > -0.3;
              g.text(r.x, r.y + 1 + k, `${padR('[' + (k + 1) + ']', 5)}${padR(run ? 'Running' : 'Done', 9)}${name}`, run ? P.fg : P.dim);
              bar(g, r.x + 30, r.y + 1 + k, Math.max(4, r.w - 32), (0.5 + 0.5 * Math.sin(t * 1.3 + k * 2 + i)), P.orange, ' ', P.dim2);
            }
            break;
          }
        }
      },
    };
  }

  /** A stack trace that keeps arriving: a worker's exception every bar, each with its frames, caught and retried. */
  trace(i: number, t0: number): LogLine[] {
    let l = this.logs.get(i * 2 + 100000);
    if (!l) {
      l = [];
      const errs = ["KeyError: 'cake'", 'TimeoutError: elevator did not arrive', 'ValueError: cube weight 0.0 kg', 'RuntimeError: portal pair mismatch', 'PermissionError: /dev/neurotoxin', 'ZeroDivisionError: subjects alive'];
      const files = ['chambers/delivery.py', 'chambers/elevator.py', 'testing/cube.py', 'portal/pair.py', 'safety/valves.py', 'stats/report.py'];
      for (let k = 0; k < 40; k++) {
        const tk = t0 + k * 2.0, e = (i + k) % errs.length;
        l.push({ t: tk, text: 'Traceback (most recent call last):', fg: P.fg });
        l.push({ t: tk + 0.08, text: `  File "/srv/glados/core.py", line ${400 + k}, in run_loop`, fg: P.dim });
        l.push({ t: tk + 0.08, text: '    self.testing.step()', fg: P.dim });
        l.push({ t: tk + 0.16, text: `  File "/srv/glados/${files[e]}", line ${20 + (k * 7) % 90}, in step`, fg: P.dim });
        l.push({ t: tk + 0.16, text: `    ${['tray = serve(CAKE)', 'car.wait(timeout=30)', 'assert cube.mass > 0', 'pair.link(orange, blue)', 'valve.open()', 'rate = done / alive'][e]}`, fg: P.dim });
        l.push({ t: tk + 0.3, text: errs[e]!, fg: P.orange });
        l.push({ t: tk + 0.9, text: `[retry ${k + 1}] caught; continuing`, fg: P.dim2 });
      }
      this.logs.set(i * 2 + 100000, l);
    }
    return l;
  }

  log(i: number, t0: number, strace = false): LogLine[] {
    let l = this.logs.get(i * 2 + (strace ? 1 : 0));
    if (!l) {
      l = [];
      for (let k = 0; k < 160; k++) {
        const text = strace ? straceLine(i * 1000 + k) : `${pad((t0 + k * 0.08).toFixed(3), 9)} ${JOBS[(i + k) % JOBS.length]}: ${['ok', 'seated', 'queued', 'written', 'polled', 'synced'][Math.floor(hash(i, k, 3) * 6)]} ${FILES[Math.floor(hash(i, k, 4) * FILES.length)]!.split('/').pop()}`;
        l.push({ t: t0 + k * (strace ? 0.045 : 0.09 + 0.08 * hash(i, k)), text, fg: k % 8 === 5 ? P.fg : P.dim });
      }
      this.logs.set(i * 2 + (strace ? 1 : 0), l);
    }
    return l;
  }
}
