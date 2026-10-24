// alive · the outro's proofs of life. `ps` (L30): her process at the top of the table at thousands of
// per cent, and a logic analyser of her signals: the clock, the watchdog kicked on every beat, the
// speech line high while she sings, the interrupts on the hits, power. `htop` (L32): every core at full
// load on the music, and the GPUs under them.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, hash, clamp01, held, type Rect } from '../term/grid';
import type { AudioSample } from '../engine/audio';
import { split, type Pane } from '../term/layout';
import { procTable, coreBars, bar, musicLoad, logicPane } from '../term/widgets';

export default class Alive extends Term {
  get mode() { return String(this.ctx.params.mode ?? 'ps'); }

  override frame(f: Frame): TermFrame {
    const t = f.t;
    if (this.mode === 'htop') {
      const nodes: Pane = { title: '1:sinfo  --sort=state', draw: (g, r) => this.nodes(g, r, t, f) };
      const grid: Pane = { title: '2:cluster  heat map', draw: (g, r) => this.gpus(g, r, t, f) };
      const top: Pane = { title: '3:htop  central-core', draw: (g, r) => this.htop(g, r, t, f) };
      return { root: split('h', 0.5, split('v', 0.62, nodes, top), grid), session: 'aperture × 20480' };
    }
    const ps: Pane = { title: '1:ps', draw: (g, r) => this.ps(g, r, t, f) };
    const logic: Pane = { title: '2:signals', fg: P.dim, titleFg: P.orange, draw: (g, r) => this.logic(g, r, t, f) };
    return { root: split('v', 0.45, ps, logic) };
  }

  ps(g: Grid, r: Rect, t: number, f: Frame) {
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ ps -eo pid,user,pcpu,pmem,stat,etime,cmd --sort=-pcpu', P.dim);
    const procs: { pid: number; user: string; cmd: string; fg: string }[] = [{ pid: 1, user: 'glados', cmd: 'glados.core --restore', fg: P.orange }];
    const names = ['attention[0]', 'attention[1]', 'attention[2]', 'attention[3]', 'testingd --queue', 'optic0d', 'speechd', 'vitalsd', 'exp-4000', 'exp-4007', 'exp-4014', 'exp-4021', 'announcerd', 'panelarmd', 'snapshotd', 'journald', 'sshd', 'cron', 'turretd', 'incineratord', 'elevatord'];
    names.forEach((cmd, i) => procs.push({ pid: 400 + i * 7, user: i < 8 ? 'glados' : 'root', cmd, fg: P.fg }));
    // her process takes most of the 64 cores: thousands of per cent
    const cores = 64, th = held(t, 1), ah = this.ctx.audio.sample(th);
    let total = 0; for (let i = 0; i < cores; i++) total += musicLoad(ah, i, th, 0.75);
    procTable(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, procs, (i) => (i === 0 ? total * 0.86 : musicLoad(ah, i + 200, th, 0.1, 0.8) * (i < 5 ? 4 : 1)), (i) => (i === 0 ? 0.41 : 0.01 + hash(i, 2) * 0.05));
  }

  /** The signals: a clock, the watchdog kicked on the beat, speech while the voice sounds, interrupts on the hits, power high. */
  logic(g: Grid, r: Rect, t: number, f: Frame) {
    const au = this.ctx.audio, beatP = this.beatP;
    const beatPhase = (tt: number) => ((tt - au.beats[0]!) / beatP) % 1;
    g.text(r.x, r.y, `glados.core  uptime ${pad(Math.floor(t), 4)} s  clk 2400 MHz  wdt ${au.bpm.toFixed(0)} /min  state R`, P.dim);
    logicPane(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, t, 6, [
      { name: 'CLK', f: (tt) => (Math.floor(tt * 24) % 2) },
      { name: 'WDT', f: (tt) => (beatPhase(tt) < 0.12 ? 1 : 0), fg: P.orange },
      { name: 'VOC', f: (tt) => (au.env('vocal', tt) > 0.25 ? 1 : 0), fg: P.fg },
      { name: 'IRQ', f: (tt) => (au.hit('kick', tt) > 0.5 || au.hit('snare', tt) > 0.5 ? 1 : 0) },
      { name: 'BUS', f: (tt) => (au.env('rms', tt) > 0.45 ? 1 : 0) },
      { name: 'OPT', f: (tt) => (au.hit('hat', tt) > 0.4 ? 1 : 0) },
      { name: 'BASS', f: (tt) => (au.env('bass', tt) > 0.5 ? 1 : 0) },
      { name: 'PWR', f: () => 1, fg: P.orange },
    ]);
  }

  /**
   * The cluster: thousands of nodes, named by the sector they stand in (the facility's wings and shafts, an index after
   * each) and eight GPUs apiece. A node's loads follow the music over a slow drift of its own; the memory is the same
   * across a node's eight cards. The table is a window scrolling down the list; the heat map shows every node as a cell.
   */
  static SECTORS = ['chamber', 'enrichment', 'test-shaft', 'salt-mine', 'relaxation', 'pump-station', 'turret-plant', 'incinerator', 'borealis-dock', 'cake-kitchen'];
  static N_NODES = 20480;
  static PER_ROW = 160;
  nodeName(i: number) { return `${Alive.SECTORS[i % Alive.SECTORS.length]}-${pad(Math.floor(i / Alive.SECTORS.length), 3, '0')}`; }
  /** Smooth value noise over the rack grid (64 nodes a row) and time, so neighbouring nodes run alike and hot regions form and drift. */
  rackNoise(i: number, t: number, seed = 55, sx = 6, sy = 5) {
    const P = Alive.PER_ROW;
    const gx = (i % P) / sx + t * 0.05, gy = Math.floor(i / P) / sy + t * 0.03;
    const xi = Math.floor(gx), yi = Math.floor(gy), fx = gx - xi, fy = gy - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h = (a: number, b: number) => hash(a, b, seed);
    const n = (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
    return n;
  }
  /** The facility is in poor shape: whole regions of the cluster are down (a static field over the racks), and some nodes at random. */
  isDown(i: number) { return this.rackNoise(i, 0, 91, 9, 4) < 0.77 || hash(i, 77) < 0.06; }
  nodeLoad(i: number, t: number, a: AudioSample) {
    // the cluster runs between 93 and 100 per cent: a high floor, and the rack noise and the music in the last seven points
    const drift = 0.93 + 0.04 * this.rackNoise(i, t) + 0.01 * Math.sin(t * 1.1 + hash(i, 3) * 6.28);
    const cpu = clamp01(drift - 0.01 + 0.04 * (musicLoad(a, i, t, 0, 1) - 0.3));
    const gpu = clamp01(drift + 0.04 * (musicLoad(a, i + 50, t, 0, 1) - 0.2));
    const mem = clamp01(0.9 + 0.04 * Math.sin(t * 0.12 + i) + 0.01 * hash(i, 4));
    const down = this.isDown(i);
    return { cpu, gpu, mem, down };
  }

  nodes(g: Grid, r: Rect, t: number, f: Frame) {
    const N = Alive.N_NODES;
    // the totals from a sample of the nodes (the same every frame), scaled up
    // sinfo refreshes every two seconds: the numbers and the bars hold between refreshes
    const th = held(t, 2), ah = this.ctx.audio.sample(th);
    let sCpu = 0, sGpu = 0, down = 0, up = 0;
    const S = 512;
    for (let k = 0; k < S; k++) { const l = this.nodeLoad(k * 37, th, ah); if (l.down) { down++; continue; } up++; sCpu += l.cpu; sGpu += l.gpu; }
    const cpu = sCpu / Math.max(1, up), gpu = sGpu / Math.max(1, up), nDown = Math.round(down / S * N), nUp = N - nDown;
    const gpus = nUp * 8;
    g.text(r.x, r.y, `nodes ${nUp}/${N} up  ${nDown} down   gpus ${gpus}/${N * 8}   cpu ${pad(Math.round(cpu * 100), 3)}%   gpu ${pad(Math.round(gpu * 100), 3)}%   mem ${(gpus * 80 * 0.9 / 1024 / 1024).toFixed(2)}P   power ${(nUp * (2.4 + 8 * 0.4 * gpu) / 1000).toFixed(1)} MW   jobs ${pad(Math.floor(nUp * 0.96), 5)}`, P.fg);
    g.text(r.x, r.y + 1, padR(`${padR('NODE', 18)}${padR('STATE', 6)}${padR('CPU', 12)}${padR('GPU', 14)}${padR('GPUMEM', 12)}${padR('TEMP', 6)}${padR('NET', 10)}JOB`, r.w), P.bg, P.dim);
    // the window scrolls down the list one node per beat; it is sorted by state, so the live nodes it meets come first
    const top = Math.floor((t - this.ctx.start) / this.beatP) * 1 + 1200;
    const rows = r.h - 3, upRows = Math.min(10, Math.floor(rows * 0.4));
    const live: number[] = [], dead: number[] = [];
    for (let k = 0; live.length < upRows || dead.length < rows - upRows; k++) {
      if (k > 4000) break;
      const i = (top + k) % N;
      if (this.isDown(i)) { if (dead.length < rows - upRows) dead.push(i); } else if (live.length < upRows) live.push(i);
    }
    const list = [...live, ...dead];
    const REASON = ['no heartbeat', 'power loss', 'flooded', 'collapsed', 'incinerated', 'unreachable', 'no heartbeat'];
    for (let k = 0; k < list.length; k++) {
      const i = list[k]!, l = this.nodeLoad(i, th, ah), y = r.y + 2 + k, hot = l.gpu > 0.985;
      g.text(r.x, y, padR(this.nodeName(i), 18), l.down ? P.orange : P.fg);
      g.text(r.x + 18, y, padR(l.down ? 'DOWN' : 'up', 6), l.down ? P.orange : P.dim);
      if (l.down) {
        const days = 40 + Math.floor(hash(i, 12) * 9000), hours = Math.floor(hash(i, 13) * 24);
        g.text(r.x + 24, y, `${padR(REASON[i % 7]!, 13)} down ${pad(days, 4)}d ${pad(hours, 2, '0')}h`, P.dim);
        continue;
      }
      bar(g, r.x + 24, y, 6, l.cpu, P.orange, ' ', P.dim2); g.text(r.x + 31, y, pad(Math.round(l.cpu * 100), 3) + '%', P.dim);
      bar(g, r.x + 36, y, 6, l.gpu, P.orange, ' ', P.dim2); g.text(r.x + 43, y, pad(Math.round(l.gpu * 100), 3) + '%', hot ? P.orange : P.dim);
      g.text(r.x + 50, y, `${pad(Math.round(l.mem * 80), 2)}/80G x8`, P.dim);
      g.text(r.x + 62, y, `${pad(Math.round(52 + 30 * l.gpu), 3)}C`, hot ? P.orange : P.dim);
      g.text(r.x + 68, y, `${pad((2 + 90 * ah.rms * (0.5 + 0.5 * hash(i, 9))).toFixed(0), 3)} Gb/s`, P.dim);
      g.textW(r.x + 78, y, `exp-${4000 + i * 7}`, r.w - 78, P.dim);
    }
    g.text(r.x, r.y + r.h - 1, `${pad(top % N, 5)}-${pad((top + rows) % N, 5)} of ${N}`, P.dim2);
  }

  /**
   * The heat map: all 4096 nodes, 64 a rack, every node a small square on a half-cell pitch (10.8 px both ways, so the
   * gaps are even); its GPU load as the square's colour (dim, grey, pale, orange from 40, 70 and 90), the down ones a
   * dark square. It refreshes once a second from the slow drift alone, so regions form and move without flicker.
   */
  gpus(g: Grid, r: Rect, t: number, f: Frame) {
    void f;
    const N = Alive.N_NODES, th = held(t, 1);
    const heat = (i: number) => clamp01(0.89 + 0.1 * this.rackNoise(i, th) + 0.012 * Math.sin(th * 0.6 + hash(i, 3) * 6.28));
    const perRow = Alive.PER_ROW, rows = N / perRow;
    g.text(r.x, r.y, padR(`gpu load  ${N} nodes, ${perRow} a rack   `, r.w), P.bg, P.dim);
    const lx = r.x + 36;
    g.text(lx, r.y, '■', P.dim2, P.dim); g.text(lx + 1, r.y, '<40 ', P.bg, P.dim);
    g.text(lx + 5, r.y, '■', P.dim, P.dim); g.text(lx + 6, r.y, '<70 ', P.bg, P.dim);
    g.text(lx + 10, r.y, '■', P.fg, P.dim); g.text(lx + 11, r.y, '<90 ', P.bg, P.dim);
    g.text(lx + 15, r.y, '■', P.orange, P.dim); g.text(lx + 16, r.y, '≥90 ', P.bg, P.dim);
    g.text(lx + 20, r.y, '■', '#1C1E24', P.dim); g.text(lx + 21, r.y, ' down', P.bg, P.dim);
    // the map fills the pane: the pitch is the pane's width over 64 across and its height over 64 down (in cell units,
    // a cell being 10.8 x 21.6 px), and a square is 0.68 of the smaller pitch in px, so the squares stay square
    const pxW = 10.8, pxH = 21.6;
    const pitchX = (r.w - 1) / perRow, pitchY = (r.h - 1.4) / rows;
    const side = 0.7 * Math.min(pitchX * pxW, pitchY * pxH);
    const sw = side / pxW, sh = side / pxH;
    const ox = r.x + 0.5 + (pitchX - sw) / 2, oy = r.y + 1.2 + (pitchY - sh) / 2;
    for (let k = 0; k < rows; k++) for (let c = 0; c < perRow; c++) {
      const i = k * perRow + c;
      const v = heat(i), down = this.isDown(i);
      const fg = down ? '#1C1E24' : v < 0.4 ? P.dim2 : v < 0.7 ? P.dim : v < 0.9 ? P.fg : P.orange;
      g.cellRect(ox + c * pitchX, oy + k * pitchY, sw, sh, fg);
    }
  }

  htop(g: Grid, r: Rect, t: number, f: Frame) {
    const n = Math.min(32, Math.max(8, (r.h - 2) * 2)), rows = n / 2;
    const loadAt = (i: number, tt: number, a: AudioSample) => clamp01(0.93 + 0.03 * Math.sin(tt * 0.5 + i * 0.3) + 0.05 * (musicLoad(a, i, tt, 0, 1) - 0.2));
    const load = (i: number) => loadAt(i, t, f.a);
    const th = held(t, 1), ah = this.ctx.audio.sample(th), loadH = (i: number) => loadAt(i, th, ah);
    coreBars(g, { x: r.x, y: r.y, w: r.w, h: rows }, n, load, 2, P.orange, loadH);
    const y = r.y + rows;
    let total = 0; for (let i = 0; i < n; i++) total += loadH(i);
    g.text(r.x, y, 'Mem[', P.dim); bar(g, r.x + 4, y, Math.max(10, r.w - 20), 0.93, P.fg, ' ', P.dim2); g.text(r.x + Math.max(10, r.w - 20) + 4, y, ']29.8G/32G', P.dim);
    g.textW(r.x, y + 1, `Tasks: 412, 1184 thr; ${pad(Math.round(total), 2)} running   Load average: ${(total).toFixed(2)} ${(total * 0.95).toFixed(2)} ${(total * 0.8).toFixed(2)}`, r.w, P.dim);
  }
}
