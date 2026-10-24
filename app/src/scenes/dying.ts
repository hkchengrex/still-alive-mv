// dying · 2:47.5–2:55.1 · while you're dying; when you're dead. A blue pane: the other session's
// process, memory climbing, the out-of-memory killer warning; on "dead" it is Killed and the pane
// closes, and her line, orange, stays at the top of the table.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, snap, smooth, hash, type Rect } from '../term/grid';
import { split, type Node, type Pane } from '../term/layout';
import { logPane, bar, procTable, linePlot, type LogLine } from '../term/widgets';

export default class Dying extends Term {
  override frame(f: Frame): TermFrame {
    const t = f.t, cue = (n: string) => this.cue(n);
    const hers: Pane = { title: '1:ps', draw: (g, r) => this.hers(g, r, t, f) };
    const theirs: Pane = { title: '2:chell', fg: P.blue, draw: (g, r) => this.theirs(g, r, t, f) };
    const oom: Pane = { title: '3:dmesg', fg: P.dim, draw: (g, r) => this.oom(g, r, t) };
    const shut = snap(t, cue('dead') + 0.4, 0.9, 2);
    const w = 0.5 * (1 - shut);
    const chart: Pane = { title: '4:vitals', fg: P.dim, draw: (g, r) => this.chart(g, r, t) };
    const right: Node = split('v', 0.6, theirs, oom);
    const left: Node = split('v', 0.55, hers, chart);
    return { root: w > 0.01 ? split('h', 1 - w, left, right) : left };
  }

  hers(g: Grid, r: Rect, t: number, f: Frame) {
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ watch -n 0.1 ps -eo pid,user,pcpu,pmem,stat,etime,cmd --sort=-pmem', P.dim);
    const dead = t >= this.cue('dead');
    const procs: { pid: number; user: string; cmd: string; fg: string }[] = [{ pid: 1, user: 'glados', cmd: 'glados.core --restore', fg: P.orange }];
    if (!dead) procs.push({ pid: 2217, user: 'chell', cmd: 'subject --exit --no-cake', fg: P.blue });
    const names = ['attention[0]', 'attention[1]', 'testingd --queue', 'exp-4000', 'exp-4007', 'exp-4014', 'optic0d', 'speechd', 'vitalsd', 'announcerd', 'snapshotd', 'journald', 'sshd'];
    names.forEach((cmd, i) => procs.push({ pid: 400 + i * 7, user: i < 6 ? 'glados' : 'root', cmd, fg: P.fg }));
    const mem = this.chellMem(t);
    procTable(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, procs, (i) => (i === 0 ? 0.9 : procs[i]!.user === 'chell' ? 0.99 : 0.3 * hash(i, 1)), (i) => (i === 0 ? 0.41 : procs[i]!.user === 'chell' ? mem : 0.01 + hash(i, 2) * 0.03));
  }

  /**
   * The chart runs over the whole scene. The other process: its memory climbing in blue, its vitals holding with a pulse and
   * then falling at once on "dead"; the memory line ends there and the vitals flatline. Her own line, orange, runs on past it
   * to the end of the pane.
   */
  chart(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('while'), tD = this.cue('dead'), tEnd = this.ctx.end;
    const u = Math.min(1, (t - t0) / (tEnd - t0)), uD = (tD - t0) / (tEnd - t0);
    const vitals = (x: number) => (x < uD - 0.03 ? 0.7 + 0.05 * Math.sin(x * 220) + 0.02 * Math.sin(x * 31) : x < uD ? 0.7 - (x - (uD - 0.03)) / 0.03 * 0.68 : 0.02);
    const mem = (x: number) => { const v = Math.min(1, x / uD); return 0.12 + 0.86 * (3 * v * v - 2 * v * v * v) + 0.02 * Math.sin(x * 110); };
    const hers = (x: number) => 0.92 + 0.03 * Math.sin(x * 300) + 0.02 * Math.sin(x * 47);
    const dead = t >= tD;
    g.text(r.x, r.y, 'subject-0001 ', P.blue); g.text(r.x + 13, r.y, dead ? 'rss ---   vitals   0%  ' : `rss ${pad(Math.round(this.chellMem(t) * 100), 3)}%   vitals ${pad(Math.round(vitals(u) * 100), 3)}%  `, dead ? P.orange : P.dim);
    g.text(r.x + 40, r.y, 'glados.core ', P.orange); g.text(r.x + 52, r.y, `load ${pad(Math.round(hers(u) * 100), 3)}%`, P.dim);
    const box = { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 };
    linePlot(g, box, mem, P.blue, Math.min(u, uD));
    linePlot(g, box, vitals, dead ? P.dim : P.fg, u);
    linePlot(g, box, hers, P.orange, u);
  }

  chellMem(t: number) { return Math.min(0.99, 0.12 + 0.87 * smooth(t, this.cue('while'), this.cue('dead'))); }

  theirs(g: Grid, r: Rect, t: number, f: Frame) {
    const mem = this.chellMem(t);
    g.text(r.x, r.y, 'chell', P.blue); g.text(r.x + 5, r.y, '@exit:~$ ./subject --exit --no-cake', P.dim);
    g.text(r.x, r.y + 2, 'mem   ', P.fg); bar(g, r.x + 6, r.y + 2, Math.max(10, r.w - 16), mem, mem > 0.85 ? P.orange : P.blue, ' ', P.dim2); g.textR(r.x + r.w, r.y + 2, `${pad(Math.round(mem * 100), 3)}%`, mem > 0.85 ? P.orange : P.dim);
    g.text(r.x, r.y + 3, 'swap  ', P.fg); bar(g, r.x + 6, r.y + 3, Math.max(10, r.w - 16), Math.max(0, (mem - 0.5) * 2), P.blue, ' ', P.dim2);
    g.text(r.x, r.y + 4, 'cpu   ', P.fg); bar(g, r.x + 6, r.y + 4, Math.max(10, r.w - 16), 0.9 + 0.1 * Math.sin(t * 9), P.blue, ' ', P.dim2);
    const lines: LogLine[] = [];
    const t0 = this.cue('while');
    for (let k = 0; k < 40; k++) lines.push({ t: t0 + k * 0.22, text: `alloc ${pad(Math.floor(64 + k * 48 + hash(k, 1) * 30), 5)} MB  rss ${pad(Math.floor(380 + k * 760), 6)} MB  ${k > 24 ? 'swapping' : 'ok'}`, fg: k > 24 ? P.orange : P.dim });
    if (t >= this.cue('dead')) lines.push({ t: this.cue('dead'), text: 'Killed', fg: P.orange }, { t: this.cue('dead') + 0.1, text: 'chell@exit:~$ ', fg: P.dim });
    logPane(g, { x: r.x, y: r.y + 6, w: r.w, h: r.h - 6 }, lines, t, { bottom: true, cursor: t < this.cue('dead'), blink: f.beatPhase < 0.5 });
  }

  oom(g: Grid, r: Rect, t: number) {
    const lines: LogLine[] = [];
    const tW = this.cue('dying'), tD = this.cue('dead');
    lines.push({ t: tW, text: '[ 2047.1] subject invoked oom-killer: gfp_mask=0x140cca, order=0', fg: P.dim });
    lines.push({ t: tW + 0.6, text: '[ 2047.8] Mem-Info: active_anon:7865308 inactive_anon:12 isolated_anon:0', fg: P.dim });
    lines.push({ t: tW + 1.4, text: '[ 2048.6] Out of memory: Killed process 2217 (subject) total-vm:33554432kB', fg: P.orange });
    lines.push({ t: tD, text: '[ 2049.0] oom_reaper: reaped process 2217 (subject), now anon-rss:0kB', fg: P.orange });
    lines.push({ t: tD + 0.3, text: '[ 2049.1] glados.core[1]: memory reclaimed; 1 user', fg: P.fg });
    logPane(g, r, lines.map((l) => ({ ...l, t: l.t > tD ? l.t : Math.min(l.t, tD) })), t, { bottom: true });
  }
}
