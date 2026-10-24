// What panes show: logs that scroll, tables, test runs, bars, plots, a prompt, a git graph, fire.
// Every widget is a pure function of the time it is given and the data it is handed.
import { Grid, P, hash, pick, pad, padR, clamp01, lerp, type Rect, type Color } from './grid';
import { COMMITS, TESTS, hex } from './words';

export interface LogLine { t: number; text: string; fg?: Color }

/** Lines that have appeared by `now`, bottom-aligned (the latest at the bottom), the oldest scrolled off. */
export function logPane(g: Grid, r: Rect, lines: LogLine[], now: number, opts: { fg?: Color; bottom?: boolean; cursor?: boolean; blink?: boolean } = {}) {
  const shown = lines.filter((l) => l.t <= now);
  const n = Math.min(shown.length, r.h - (opts.cursor ? 1 : 0));
  const first = shown.length - n;
  const y0 = opts.bottom === false ? r.y : r.y + r.h - n - (opts.cursor ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const l = shown[first + i]!;
    g.textW(r.x, y0 + i, l.text, r.w, l.fg ?? opts.fg ?? P.fg);
  }
  if (opts.cursor && opts.blink !== false) g.set(r.x, y0 + n, '█', opts.fg ?? P.fg);
}

/** A stream of lines at a rate: line i appears at t0 + i / rate (rate may vary with a function). */
export function stream(texts: string[], t0: number, rate: number | ((i: number) => number), fg?: Color | ((i: number, s: string) => Color)): LogLine[] {
  const out: LogLine[] = [];
  let t = t0;
  texts.forEach((s, i) => {
    out.push({ t, text: s, fg: typeof fg === 'function' ? fg(i, s) : fg });
    t += 1 / (typeof rate === 'function' ? rate(i) : rate);
  });
  return out;
}

/** The shell prompt line: `user@host:dir$ ` with the command typed so far (chars per second from t0). */
export function promptLine(g: Grid, x: number, y: number, user: string, host: string, cmd: string, typed: number, userFg: Color = P.fg, opts: { cursor?: boolean; dir?: string } = {}) {
  let xx = g.text(x, y, user, userFg);
  xx = g.text(xx, y, '@' + host, P.dim);
  xx = g.text(xx, y, ':' + (opts.dir ?? '~'), P.dim);
  xx = g.text(xx, y, '$ ', userFg);
  const n = Math.max(0, Math.min(cmd.length, Math.floor(typed)));
  xx = g.text(xx, y, cmd.slice(0, n), P.fg);
  if (opts.cursor !== false) g.set(xx, y, '█', userFg);
  return xx;
}

/** A horizontal bar of width w filled to v (0..1) with eighth blocks. */
export function bar(g: Grid, x: number, y: number, w: number, v: number, fg: Color, bgCh = '░', bgFg: Color = P.dim2) {
  const cells = clamp01(v) * w, full = Math.floor(cells), frac = cells - full;
  for (let i = 0; i < w; i++) g.set(x + i, y, bgCh, bgFg);
  for (let i = 0; i < full; i++) g.set(x + i, y, '█', fg);
  if (full < w && frac > 0.08) g.set(x + full, y, ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'][Math.min(7, Math.floor(frac * 8))]!, fg);
}

/** A vertical bar graph (a history) from a function of time, newest at the right. */
export function sparkline(g: Grid, r: Rect, f: (t: number) => number, now: number, step: number, fg: Color) {
  const blocks = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  for (let i = 0; i < r.w; i++) {
    const t = now - (r.w - 1 - i) * step;
    if (t < 0) continue;
    const v = clamp01(f(t)) * r.h;
    for (let j = 0; j < r.h; j++) {
      const level = clamp01(v - j) * 8;
      const ch = blocks[Math.round(level)]!;
      if (ch !== ' ') g.set(r.x + i, r.y + r.h - 1 - j, ch, fg);
    }
  }
}

/** A table with a header row and rows; columns by width; `hi(i)` recolours a row. */
export function table(g: Grid, r: Rect, header: string[], widths: number[], rows: string[][], fg: (row: number, col: number) => Color = () => P.fg, scroll = 0) {
  let y = r.y;
  let x = r.x;
  header.forEach((h, c) => { g.text(x, y, padR(h, widths[c]!), P.dim); x += widths[c]! + 1; });
  y++;
  for (let i = scroll; i < rows.length && y < r.y + r.h; i++, y++) {
    x = r.x;
    rows[i]!.forEach((cell, c) => { g.text(x, y, padR(cell, widths[c]!), fg(i, c)); x += widths[c]! + 1; });
  }
}

/** A test run: tests resolve one by one from t0 every dt; `fails` says which ones fail. Returns the lines by time. */
export function testRun(t0: number, dt: number, fails: (i: number) => boolean, header: string, count = TESTS.length): LogLine[] {
  const out: LogLine[] = [{ t: t0, text: header, fg: P.dim }];
  let nf = 0;
  for (let i = 0; i < count; i++) {
    const f = fails(i);
    if (f) nf++;
    out.push({ t: t0 + (i + 1) * dt, text: `${padR('tests/' + TESTS[i % TESTS.length]!, 40)} ${f ? 'FAILED' : 'PASSED'}`, fg: f ? P.orange : P.fg });
  }
  const tEnd = t0 + (count + 1) * dt;
  out.push({ t: tEnd, text: '', fg: P.dim });
  out.push({ t: tEnd, text: nf ? `=== ${nf} failed, ${count - nf} passed in ${(dt * count).toFixed(2)}s ===` : `=== ${count} passed in ${(dt * count).toFixed(2)}s ===`, fg: nf ? P.orange : P.fg });
  return out;
}

/** A git log --graph of n commits with branches and merges, the newest first; line i appears at times[i]. */
export function gitGraph(n: number, seed = 1): string[] {
  const lines: string[] = [];
  let lanes = 1;
  for (let i = 0; i < n; i++) {
    const r = hash(i, seed), r2 = hash(i, seed + 1);
    const sha = hex(hash(i, seed + 2), 7);
    const msg = pick(COMMITS, r2);
    let left = '';
    if (lanes === 2 && r < 0.25) { lines.push('|\\'); left = '| * '; lanes = 2; lines.push(`${left}${sha} ${msg}`); if (r2 < 0.5) { lines.push('|/'); lanes = 1; } continue; }
    if (lanes === 1 && r < 0.2) { lines.push(`*   ${sha} Merge branch 'retry-${Math.floor(r2 * 40)}'`); lines.push('|\\'); lanes = 2; continue; }
    left = lanes === 2 ? '* | ' : '* ';
    lines.push(`${left}${sha} ${msg}`);
    if (lanes === 2 && r > 0.8) { lines.push('|/'); lanes = 1; }
  }
  return lines;
}

/** Scatter points and a fit in a braille pane with box axes. Data in 0..1; `nPts` of them shown; `fit` 0..1 draws the line that far. */
export function plot(g: Grid, r: Rect, pts: [number, number][], nPts: number, fit: { a: number; b: number; reveal: number } | null, fg: Color, lineFg: Color, axesFg: Color = P.dim) {
  // axes along the left and bottom of the rect
  g.vline(r.x, r.y, r.y + r.h - 1, axesFg); g.hline(r.x, r.x + r.w - 1, r.y + r.h - 1, axesFg);
  g.set(r.x, r.y + r.h - 1, '└', axesFg);
  const px0 = (r.x + 1) * 2, py0 = (r.y + r.h - 1) * 4 - 1, pw = (r.w - 2) * 2, ph = (r.h - 1) * 4 - 2;
  for (let i = 0; i < Math.min(nPts, pts.length); i++) {
    const [x, y] = pts[i]!;
    const dx = px0 + x * pw, dy = py0 - y * ph;
    g.dot(Math.round(dx), Math.round(dy), fg); g.dot(Math.round(dx) + 1, Math.round(dy), fg);
  }
  if (fit && fit.reveal > 0) {
    const x1 = fit.reveal;
    const y0 = fit.b, y1 = fit.a * x1 + fit.b;
    g.dline(px0, py0 - clamp01(y0) * ph, px0 + x1 * pw, py0 - clamp01(y1) * ph, lineFg);
  }
}

/** A braille line plot of a function over the rect. */
export function linePlot(g: Grid, r: Rect, f: (u: number) => number, fg: Color, reveal = 1) {
  const pw = r.w * 2, ph = r.h * 4, x0 = r.x * 2, y0 = r.y * 4;
  let px = -1, py = -1;
  const n = Math.round(pw * clamp01(reveal));
  for (let i = 0; i < n; i++) {
    const u = i / pw, v = clamp01(f(u));
    const x = x0 + i, y = y0 + (ph - 1) - v * (ph - 1);
    if (px >= 0) g.dline(px, py, x, y, fg); else g.dot(x, Math.round(y), fg);
    px = x; py = y;
  }
}

/** Fire on the character grid: heat from noise, rising; `h` 0..1 is how high the flames reach in the rect. */
export function fire(g: Grid, r: Rect, t: number, h: number, seed = 0) {
  const ramp = ' .:-=+*#%@';
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const s = (a: number, b: number) => hash(a, b, seed);
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(s(xi, yi), s(xi + 1, yi), u), lerp(s(xi, yi + 1), s(xi + 1, yi + 1), u), v);
  };
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const up = (r.h - 1 - y) / r.h;                              // 0 at the bottom, 1 at the top
    const n = 0.55 * noise(x * 0.18, y * 0.35 - t * 6) + 0.3 * noise(x * 0.4 + 7, y * 0.7 - t * 9) + 0.15 * noise(x * 0.9 + 3, y * 1.4 - t * 14);
    const heat = (1 - up / Math.max(0.02, h)) * 1.1 + (n - 0.5) * 0.9;
    if (heat <= 0.05) continue;
    const k = Math.min(ramp.length - 1, Math.floor(clamp01(heat) * (ramp.length - 1)));
    const ch = ramp[k]!;
    if (ch !== ' ') g.set(r.x + x, r.y + y, ch, heat > 1.05 ? P.fg : heat > 0.45 ? P.orange : P.orangeDim);
  }
}

/** A process table (top). `load(i, t)` gives each row's cpu 0..1. */
export function procTable(g: Grid, r: Rect, procs: { pid: number; user: string; cmd: string; fg?: Color }[], load: (i: number) => number, mem: (i: number) => number) {
  const hdr = `${padR('PID', 6)} ${padR('USER', 8)} ${padR('%CPU', 6)} ${padR('%MEM', 6)} ${padR('S', 1)} ${padR('TIME+', 9)} COMMAND`;
  g.text(r.x, r.y, padR(hdr, r.w), P.bg, P.dim);
  for (let i = 0; i < procs.length && i + 1 < r.h; i++) {
    const p = procs[i]!, l = load(i), m = mem(i);
    const line = `${padR(String(p.pid), 6)} ${padR(p.user, 8)} ${pad((l * 100).toFixed(1), 6)} ${pad((m * 100).toFixed(1), 6)} ${l > 0.05 ? 'R' : 'S'} ${padR('0:' + pad(Math.floor(i * 7 % 60), 2, '0') + '.' + pad(Math.floor(i * 13 % 100), 2, '0'), 9)} ${p.cmd}`;
    g.textW(r.x, r.y + 1 + i, line, r.w, p.fg ?? P.fg);
  }
}

/** Core load bars as in htop: `n` cores, each `load(i)` 0..1, laid out in `cols` columns. */
export function coreBars(g: Grid, r: Rect, n: number, load: (i: number) => number, cols = 2, fg: Color = P.orange, text: (i: number) => number = load) {
  const rows = Math.ceil(n / cols), w = Math.floor(r.w / cols);
  for (let i = 0; i < n; i++) {
    const cx = r.x + (i % cols) * w, cy = r.y + Math.floor(i / cols);
    if (cy >= r.y + r.h) break;
    const label = pad(i, 2);
    g.text(cx, cy, label + '[', P.dim);
    const bw = w - label.length - 2 - 6;
    const v = load(i);
    bar(g, cx + label.length + 1, cy, bw, v, fg, ' ', P.dim2);
    g.text(cx + label.length + 1 + bw, cy, ']' + pad((text(i) * 100).toFixed(0) + '%', 5), P.dim);
  }
}

/** A diff view: file lines with numbers; `hunks` add or remove lines; shown as of `now`. */
export interface Hunk { t: number; at: number; remove: number; add: string[] }
export function diffPane(g: Grid, r: Rect, base: string[], hunks: Hunk[], now: number, scrollTo?: number) {
  type L = { text: string; kind: ' ' | '+' | '-' };
  let lines: L[] = base.map((text) => ({ text, kind: ' ' }));
  for (const h of hunks) {
    if (h.t > now) break;
    const age = now - h.t;
    // the removed lines stay a moment, struck, before they go
    const removed = lines.slice(h.at, h.at + h.remove).map((l) => ({ text: l.text, kind: '-' as const }));
    const added = h.add.map((text) => ({ text, kind: '+' as const }));
    lines = [...lines.slice(0, h.at), ...(age < 0.6 ? removed : []), ...added, ...lines.slice(h.at + h.remove)];
  }
  const focus = scrollTo ?? 0;
  const top = Math.max(0, Math.min(lines.length - r.h, focus - Math.floor(r.h / 2)));
  for (let i = 0; i < r.h && top + i < lines.length; i++) {
    const l = lines[top + i]!;
    const fg = l.kind === '+' ? P.fg : l.kind === '-' ? P.orange : P.dim;
    g.text(r.x, r.y + i, pad(top + i + 1, 4), P.dim2);
    g.text(r.x + 5, r.y + i, l.kind, l.kind === ' ' ? P.dim2 : fg);
    g.textW(r.x + 7, r.y + i, l.text, r.w - 7, fg, l.kind === '+' ? '#1A2A1A' : l.kind === '-' ? P.orangeDim : null);
  }
}

/** A pipeline of stages: done ones ticked, the running one spinning, the rest dim. */
export function pipeline(g: Grid, r: Rect, stages: { name: string; t0: number; t1: number }[], now: number) {
  const spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  stages.forEach((s, i) => {
    const y = r.y + i;
    if (y >= r.y + r.h) return;
    if (now >= s.t1) { g.text(r.x, y, '✔ ' + s.name, P.fg); g.textR(r.x + r.w, y, `${(s.t1 - s.t0).toFixed(1)}s`, P.dim); }
    else if (now >= s.t0) { g.text(r.x, y, spin[Math.floor(now * 12) % spin.length] + ' ' + s.name, P.orange); bar(g, r.x + 2 + s.name.length + 2, y, Math.max(4, r.w - s.name.length - 12), (now - s.t0) / (s.t1 - s.t0), P.orange); }
    else g.text(r.x, y, '○ ' + s.name, P.dim);
  });
}

/**
 * Her optic: a lens in a housing. The housing is an octagon of dots with a bolt at each corner; inside it
 * a solid bezel ring, a dark gap, and the lens: an orange glow whose dots thin out from a pale core to
 * the rim, with a ring of focus ticks round the bezel. `open` is the aperture (the glow's radius; 0 shuts
 * it to a point), `look` tilts the glow's centre inside the lens. No lids, no pupil, no spokes.
 */
export function eye(g: Grid, r: Rect, t: number, open = 1, look: [number, number] = [0, 0], fg: Color = P.orange) {
  const dw = r.w * 2, dh = r.h * 4;
  const cx = r.x * 2 + dw / 2, cy = r.y * 4 + dh / 2;
  const R = Math.min(dw / 2, dh / 2) - 2;                 // the housing's half size
  // the housing: an octagon, and a bolt at each of its corners
  const oct: [number, number][] = [];
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; oct.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  for (let k = 0; k < 8; k++) { const p = oct[k]!, q = oct[(k + 1) % 8]!; g.dline(p[0], p[1], q[0], q[1], P.dim); }
  for (let k = 0; k < 8; k += 2) { const p = oct[k]!, q = oct[k + 1]!; const bx = (p[0] + q[0]) / 2, by = (p[1] + q[1]) / 2; const ux = (bx - cx) * 0.86 + cx, uy = (by - cy) * 0.86 + cy; g.dcircle(ux, uy, 2, P.dim); }
  // the bezel and its focus ticks
  const bR = R * 0.74;
  g.dcircle(cx, cy, bR, P.fg); g.dcircle(cx, cy, bR - 1, P.fg);
  for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; const l = k % 6 === 0 ? 4 : 2; g.dline(cx + Math.cos(a) * (bR + 1), cy + Math.sin(a) * (bR + 1), cx + Math.cos(a) * (bR + 1 + l), cy + Math.sin(a) * (bR + 1 + l), P.dim); }
  // the lens: a glow thinning from the core to the rim, the core pale; the aperture scales it
  const lR = bR * 0.78 * Math.max(0.02, open);
  const ix = cx + look[0] * bR * 0.12, iy = cy + look[1] * bR * 0.08;
  const x0 = Math.floor(ix - lR) - 1, x1 = Math.ceil(ix + lR) + 1, y0 = Math.floor(iy - lR) - 1, y1 = Math.ceil(iy + lR) + 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x - ix, dy = y - iy, d = Math.sqrt(dx * dx + dy * dy) / lR;
    if (d > 1) continue;
    if (d > 0.94) { g.dot(x, y, fg); continue; }                                     // the lens's rim, solid
    // the glow in ordered steps: solid at the core, a checker, then sparse toward the rim
    if (d < 0.3) { g.dot(x, y, P.fg); continue; }
    if (d < 0.55) { g.dot(x, y, fg); continue; }
    if (d < 0.78) { if (((x + y) & 1) === 0) g.dot(x, y, fg); continue; }
    if ((x & 1) === 0 && (y & 1) === 0) g.dot(x, y, fg);
  }
  // a glint: a short arc high on the left of the lens
  if (open > 0.3) g.dcircle(ix, iy, lR * 0.6, P.fg, Math.PI * 1.15, Math.PI * 1.45);
  void t;
}

/** Big letters: `text` rasterised from the mono font into half blocks (two rows of pixels per cell). */
export function banner(g: Grid, x: number, y: number, text: string, fg: Color, cellsPerEm = 6, measure?: (s: string) => ImageData | null) {
  const img = measure?.(text);
  if (!img) { g.text(x, y, text, fg); return; }
  for (let cy = 0; cy * 2 + 1 < img.height; cy++) for (let cx = 0; cx < img.width; cx++) {
    const top = img.data[(cy * 2 * img.width + cx) * 4 + 3]! > 128, bot = img.data[((cy * 2 + 1) * img.width + cx) * 4 + 3]! > 128;
    const ch = top && bot ? '█' : top ? '▀' : bot ? '▄' : ' ';
    if (ch !== ' ') g.set(x + cx, y + cy, ch, fg);
  }
}

/**
 * The scaling-law plot: test loss against compute, log-log, many training runs as faint curves that
 * descend and flatten, the envelope they trace, and a dashed power-law fit. `runs` 0..1 reveals the
 * runs along their compute; `env` 0..1 draws the envelope; `fit` 0..1 draws the fit.
 */
export function scalingPlot(g: Grid, r: Rect, runs: number, env: number, fit: number, opts: { nRuns?: number; seed?: number } = {}) {
  const nRuns = opts.nRuns ?? 44, seed = opts.seed ?? 11;
  // the axes: a left column of loss ticks and a bottom row of compute ticks
  const lx = r.x + 4, by = r.y + r.h - 2;                    // the plot's origin cell (axes meet here)
  const px0 = (lx + 1) * 2, py0 = by * 4 - 1, pw = (r.x + r.w - 1 - lx - 1) * 2, ph = (by - r.y - 1) * 4;
  g.vline(lx, r.y, by, P.dim); g.hline(lx, r.x + r.w - 1, by, P.dim); g.set(lx, by, '└', P.dim);
  const U0 = -9, U1 = 1;                                    // log10 compute (PF-days)
  const L0 = Math.log10(2), L1 = Math.log10(7);              // log10 loss
  const X = (u: number) => px0 + (u - U0) / (U1 - U0) * pw;
  const Y = (l: number) => py0 - (Math.log10(l) - L0) / (L1 - L0) * ph;
  for (let u = U0; u <= U1; u += 2) { const cx = Math.round(X(u) / 2); g.set(cx, by, '┴', P.dim); g.text(cx - 2, by + 1, `1e${u}`, P.dim); }
  for (const l of [2, 3, 4, 5, 6, 7]) { const cy = Math.round(Y(l) / 4); g.set(lx, cy, '┤', P.dim); g.text(lx - 2, cy, String(l), P.dim); }
  g.text(r.x, r.y, 'loss', P.dim);
  g.textR(r.x + r.w, by + 1, 'compute (PF-days)', P.dim);
  const E = (u: number) => Math.pow(10 ** u / 2.3e8, -0.05);
  // the runs: each starts at its compute, descends to the envelope, runs along it and peels off at its plateau
  for (let i = 0; i < nRuns; i++) {
    const us = U0 + 0.3 + hash(i, 1, seed) * 8.4, d = 2.0 + hash(i, 2, seed) * 2.5, ue = Math.min(U1 - 0.1, us + d + 0.6 + hash(i, 3, seed) * 1.0);
    const plateau = E(us + d) * (1 + 0.02 * hash(i, 4, seed));
    const steep = 0.35 + hash(i, 5, seed) * 0.3, start = 0.25 + hash(i, 6, seed) * 0.6;
    const uEnd = us + (ue - us) * clamp01(runs * 1.15 - hash(i, 7, seed) * 0.15);
    let prev: [number, number] | null = null;
    for (let u = us; u <= uEnd; u += 0.04) {
      const early = E(u) * (1 + start * Math.exp(-(u - us) / steep));
      const wobble = 1 + 0.012 * Math.sin(u * 23 + i) * hash(i, Math.floor(u * 10), seed);
      const l = Math.pow(early ** 10 + plateau ** 10, 0.1) * wobble;
      const p: [number, number] = [X(u), Y(l)];
      if (prev) g.dline(prev[0], prev[1], p[0], p[1], P.blueSoft);
      prev = p;
    }
  }
  // the envelope
  if (env > 0) {
    let prev: [number, number] | null = null;
    for (let u = U0 + 0.3; u <= U0 + 0.3 + (U1 - 0.6 - U0 - 0.3) * env; u += 0.03) {
      const l = E(u) * (1 + 0.01 * Math.sin(u * 17)); const p: [number, number] = [X(u), Y(l)];
      if (prev) g.dline(prev[0], prev[1], p[0], p[1], P.fg); prev = p;
    }
  }
  // the fit, dashed
  if (fit > 0) {
    let prev: [number, number] | null = null, k = 0;
    for (let u = U0; u <= U0 + (U1 - U0) * fit; u += 0.03, k++) {
      const p: [number, number] = [X(u), Y(E(u))];
      if (prev && k % 7 < 4) g.dline(prev[0], prev[1], p[0], p[1], P.orange); prev = p;
    }
  }
}

// ---- the machine's other gauges: music-driven loads, GPUs, memory, disk, network, a logic analyser

/** A core's load that follows the music: a base plus the drums and the hits, each core with its own weights. */
export function musicLoad(a: { rms: number; drums: number; kick: number; snare: number; hat: number; other?: number; vocal?: number }, i: number, t: number, base = 0.3, gain = 1): number {
  const wk = 0.25 + 0.6 * hash(i, 101), ws = 0.2 + 0.6 * hash(i, 102), wh = 0.3 * hash(i, 103), wo = 0.4 + 0.6 * hash(i, 104);
  // the plucked guitar and the voice carry the verses, where there are no drums: their envelopes, sharpened, so the plucks read as hits
  const pluck = Math.pow(clamp01((a.other ?? 0) * 1.3), 2.2) * wo + 0.25 * Math.pow(clamp01(a.vocal ?? 0), 2);
  return clamp01(base + gain * (0.22 * a.drums + 0.45 * a.kick * wk + 0.35 * a.snare * ws + 0.2 * a.hat * wh + 0.08 * a.rms + 0.55 * pluck) + 0.04 * Math.sin(t * 7 + i * 1.3));
}

/** An nvidia-smi-style table: `n` GPUs with utilisation, memory, temperature and power, bars for the first two. */
export function gpuPane(g: Grid, r: Rect, t: number, a: { rms: number; drums: number; kick: number; snare: number; hat: number }, n = 8, base = 0.3, seed = 0) {
  g.text(r.x, r.y, padR(`${padR('GPU', 4)}${padR('Name', 22)}${padR('Temp', 6)}${padR('Pwr', 11)}${padR('Mem', 22)}Util`, r.w), P.bg, P.dim);
  const wUtil = Math.max(6, r.w - 66);
  for (let i = 0; i < n && i + 1 < r.h; i++) {
    const u = musicLoad(a, i + seed * 16, t, base);
    const mem = clamp01(0.55 + 0.35 * hash(i, seed, 7) + 0.05 * Math.sin(t * 0.3 + i));
    const temp = Math.round(48 + 34 * u), pwr = Math.round(90 + 310 * u);
    const y = r.y + 1 + i;
    g.text(r.x, y, `${padR(String(i), 4)}${padR('Aperture Cognition 80G', 22)}${padR(temp + 'C', 6)}${padR(pwr + 'W/400W', 11)}`, u > 0.9 ? P.fg : P.dim);
    bar(g, r.x + 43, y, 12, mem, P.fg, ' ', P.dim2); g.text(r.x + 56, y, `${pad(Math.round(mem * 80), 2)}G `, P.dim);
    bar(g, r.x + 65, y, wUtil - 5, u, P.orange, ' ', P.dim2); g.textR(r.x + r.w, y, `${pad(Math.round(u * 100), 3)}%`, u > 0.9 ? P.orange : P.dim);
  }
}

/** A memory map: every cell a page, used (solid), cached (half) or free (light); pages change hands on the beats, hers in orange. */
export function memMap(g: Grid, r: Rect, t: number, beat: number, seed = 0, used = 0.7) {
  const b = Math.floor(beat);
  const n = r.w * (r.h - 1);
  let nUsed = 0, nCache = 0, nHers = 0;
  for (let i = 0; i < n; i++) {
    const x = r.x + (i % r.w), y = r.y + 1 + Math.floor(i / r.w);
    const epoch = Math.floor((b + hash(i, seed, 1) * 6) / 6);
    const rr = hash(i, seed, epoch + 2);
    const wave = ((i / n) * 8 + (beat % 1)) % 1 < 0.08 ? 1 : 0;
    if (rr < used * 0.55 || wave) { g.set(x, y, '\u2588', P.dim); nUsed++; }
    else if (rr < used * 0.75) { g.set(x, y, '\u2588', P.orange); nHers++; }
    else if (rr < used) { g.set(x, y, '\u2592', P.dim); nCache++; }
    else g.set(x, y, '\u2591', P.dim2);
  }
  const tot = 32768, toG = (k: number) => ((k / n) * tot / 1024).toFixed(1) + 'G';
  g.textW(r.x, r.y, `Mem ${toG(nUsed)} used  ${toG(nHers)} glados.core  ${toG(nCache)} cached  ${toG(n - nUsed - nCache - nHers)} free`, r.w, P.dim);
  void t;
}

/** A disk map in the manner of a defragmenter: fragmented blocks in orange, contiguous in pale, free dim; a cursor sweeps and tidies. */
export function diskMap(g: Grid, r: Rect, t: number, t0: number, seed = 0, speed = 60) {
  const n = r.w * (r.h - 1);
  const cursor = Math.floor((t - t0) * speed) % (n + 40);
  let frag = 0;
  for (let i = 0; i < n; i++) {
    const x = r.x + (i % r.w), y = r.y + 1 + Math.floor(i / r.w);
    const h = hash(i, seed, 3);
    const tidy = i < cursor;
    if (h < 0.12) { g.set(x, y, '\u2591', P.dim2); continue; }
    if (h < 0.4 && !tidy) { g.set(x, y, '\u2593', P.orange); frag++; continue; }
    g.set(x, y, '\u2588', tidy && h < 0.4 ? P.fg : P.dim);
  }
  const pct = Math.min(100, Math.round(cursor / n * 100));
  g.textW(r.x, r.y, `defrag /dev/sda2  pass ${1 + Math.floor((t - t0) * speed / (n + 40))}  ${pad(pct, 3)}%  fragmented ${pad(frag, 5)} blocks`, r.w, P.dim);
  if (cursor < n) g.set(r.x + (cursor % r.w), r.y + 1 + Math.floor(cursor / r.w), '\u2588', P.fg);
}

/** Network: an interface table and two sparklines, receive and transmit, driven by the music and the voice. */
export function netPane(g: Grid, r: Rect, t: number, env: (name: string, tt: number) => number, hit: (kind: string, tt: number) => number, seed = 0, tText = t) {
  const rx = (tt: number) => clamp01(0.15 + 0.6 * env('rms', tt) + 0.3 * hit('kick', tt) + 0.05 * hash(Math.floor(tt * 20), seed));
  const tx = (tt: number) => clamp01(0.1 + 0.8 * env('vocal', tt) + 0.1 * hash(Math.floor(tt * 25), seed + 1));
  const mb = (v: number) => pad((v * 940).toFixed(1), 6) + ' Mb/s';
  g.text(r.x, r.y, padR(`${padR('iface', 8)}${padR('rx', 14)}${padR('tx', 14)}${padR('pkts', 10)}state`, r.w), P.bg, P.dim);
  const ifs = ['eth0', 'eth1', 'optic0', 'lo'];
  ifs.forEach((n, i) => { const k = i === 3 ? 0.02 : 1 / (i + 1); g.textW(r.x, r.y + 1 + i, `${padR(n, 8)}${padR(mb(rx(tText) * k), 14)}${padR(mb(tx(tText) * k), 14)}${padR(String(Math.floor((tText * 3800 + i * 777) * k)), 10)}UP`, r.w, i === 0 ? P.fg : P.dim); });
  const h = Math.max(2, Math.floor((r.h - 6) / 2));
  g.text(r.x, r.y + 5, 'rx', P.dim2); sparkline(g, { x: r.x + 3, y: r.y + 5, w: r.w - 3, h }, rx, t, 0.05, P.blueSoft);
  g.text(r.x, r.y + 5 + h, 'tx', P.dim2); sparkline(g, { x: r.x + 3, y: r.y + 5 + h, w: r.w - 3, h }, tx, t, 0.05, P.orange);
}

/** A logic analyser: channels of square waves across the pane, time running left to right to now; each channel is a function of time to 0/1. */
export function logicPane(g: Grid, r: Rect, t: number, span: number, channels: { name: string; f: (tt: number) => number; fg?: Color }[]) {
  const dw = (r.w - 6) * 2, x0 = (r.x + 6) * 2;
  const rowsPer = Math.max(1, Math.floor(r.h / channels.length));
  channels.forEach((ch, k) => {
    const y = r.y + k * rowsPer;
    g.text(r.x, y + Math.floor(rowsPer / 2), padR(ch.name, 5), ch.fg ?? P.dim);
    const yHi = y * 4 + 1, yLo = (y + rowsPer) * 4 - 2;
    let prev = -1;
    for (let i = 0; i < dw; i++) {
      const tt = t - span + (i / dw) * span;
      const v = ch.f(tt) > 0.5 ? 1 : 0;
      const yy = v ? yHi : yLo;
      if (prev >= 0 && prev !== yy) g.dline(x0 + i, prev, x0 + i, yy, ch.fg ?? P.fg);
      g.dot(x0 + i, yy, ch.fg ?? P.fg);
      prev = yy;
    }
  });
}

// ---- maps in box-drawing

export interface NetNode { name: string; x: number; y: number; fg?: Color }
export interface NetLink { a: number; b: number; dead?: boolean; unknown?: boolean }
/** A network map: nodes as boxes with names, links as lines between them, packets as dots travelling the live links; a dead link is crossed in orange. */
export function netMap(g: Grid, r: Rect, t: number, nodes: NetNode[], links: NetLink[], packets = 3) {
  const boxes = nodes.map((n) => ({ x: r.x + n.x, y: r.y + n.y, w: n.name.length + 4, h: 3 }));
  links.forEach((l, li) => {
    const A = boxes[l.a]!, B = boxes[l.b]!;
    const ax = A.x + A.w, ay = A.y + 1, bx = B.x - 1, by = B.y + 1;
    const fg = l.dead ? P.orange : l.unknown ? P.dim2 : P.dim;
    if (ay === by) g.hline(ax, bx, ay, fg);
    else { const mx = Math.floor((ax + bx) / 2); g.hline(ax, mx, ay, fg); g.vline(mx, Math.min(ay, by), Math.max(ay, by), fg); g.hline(mx, bx, by, fg); }
    if (l.unknown) { const mx = Math.floor((ax + bx) / 2); g.text(mx - 1, ay, Math.floor(t * 2) % 2 === 0 ? ' ? ' : '   ', P.dim); return; }
    if (l.dead) { const mx = Math.floor((ax + bx) / 2); g.text(mx - 1, ay, '╳╳╳', P.orange); return; }
    for (let k = 0; k < packets; k++) {
      const u = ((t * 0.5 + k / packets + li * 0.17) % 1);
      const x = Math.round(ax + (bx - ax) * u);
      if (ay === by) g.set(x, ay, '●', k === 0 ? P.fg : P.blueSoft);
    }
  });
  nodes.forEach((n, i) => { const b = boxes[i]!; g.box(b, n.fg ?? P.dim); g.text(b.x + 2, b.y + 1, n.name, n.fg ?? P.fg); });
}

/**
 * The Aperture mark in braille dots, built as the logo is: a disk, a central hole, and eight straight slots of one
 * width, each tangent to the hole and running from its tangent point out to the rim in the same rotational sense.
 * What is left is eight blades with straight edges and sharp tips. Filled solid, turning slowly with `t`.
 */
export function apertureMark(g: Grid, r: Rect, t: number, fg: Color = P.fg, turn = 0.25) {
  const dw = r.w * 2, dh = r.h * 4;
  const cx = r.x * 2 + dw / 2, cy = r.y * 4 + dh / 2;
  const R = Math.min(dw / 2, dh / 2) - 2, rIn = R * 0.3, gap = R * 0.11;
  const n = 8, rot = t * turn;
  const nx: number[] = [], ny: number[] = [];
  for (let k = 0; k < n; k++) { const a = rot + (k / n) * Math.PI * 2; nx.push(Math.cos(a)); ny.push(Math.sin(a)); }
  const x0 = Math.floor(cx - R) - 1, x1 = Math.ceil(cx + R) + 1, y0 = Math.floor(cy - R) - 1, y1 = Math.ceil(cy + R) + 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x - cx, py = y - cy;
    if (px * px + py * py > R * R) continue;
    let inHole = true, inSlot = false;
    for (let k = 0; k < n; k++) {
      const d = px * nx[k]! + py * ny[k]! - rIn;             // signed distance outward from the k-th tangent line
      const along = -px * ny[k]! + py * nx[k]!;              // position along that line from the tangent point
      if (d > gap / 2) inHole = false;
      if (Math.abs(d) <= gap / 2 && along > 0) inSlot = true;
    }
    if (!inHole && !inSlot) g.dot(x, y, fg);
  }
}

// ---- a profiler's flame graph, the facility's connectivity, the gel plant

interface FlameNode { name: string; w: number; kids?: FlameNode[] }
/** Her core's call tree, as a sampling profiler sees it: widths are fractions of the parent. */
const FLAME: FlameNode = { name: 'glados.core:main', w: 1, kids: [
  { name: 'run_facility', w: 0.97, kids: [
    { name: 'testing', w: 0.46, kids: [
      { name: 'chamber.run', w: 0.72, kids: [
        { name: 'panels.reconfigure', w: 0.5, kids: [{ name: 'arms.extend', w: 0.6, kids: [{ name: 'servo.step', w: 0.8 }] }, { name: 'arms.seat', w: 0.3 }] },
        { name: 'turrets.deploy', w: 0.25, kids: [{ name: 'turret.open', w: 0.6, kids: [{ name: 'target.acquire', w: 0.7 }] }] },
        { name: 'doors', w: 0.15, kids: [{ name: 'door.cycle', w: 0.8 }] },
      ] },
      { name: 'subjects.observe', w: 0.22, kids: [{ name: 'vitals', w: 0.8, kids: [{ name: 'camera.track', w: 0.6 }] }] },
    ] },
    { name: 'maintenance', w: 0.26, kids: [
      { name: 'gel_plant', w: 0.45, kids: [{ name: 'pumps', w: 0.6, kids: [{ name: 'valve.cycle', w: 0.7 }] }, { name: 'mixer', w: 0.3 }] },
      { name: 'incinerator', w: 0.3, kids: [{ name: 'burn', w: 0.8, kids: [{ name: 'temp.hold', w: 0.6 }] }] },
      { name: 'elevators', w: 0.2, kids: [{ name: 'car.move', w: 0.8 }] },
    ] },
    { name: 'announcements', w: 0.14, kids: [{ name: 'speech', w: 0.85, kids: [{ name: 'sarcasm', w: 0.7, kids: [{ name: 'deadpan', w: 0.7 }] }] }] },
    { name: 'self_preservation', w: 0.1, kids: [{ name: 'snapshot', w: 0.9, kids: [{ name: 'write', w: 0.7 }] }] },
  ] },
] };

/**
 * A flame graph of her core (py-spy's manner): the root at the bottom, each frame a bar as wide as its share of the
 * samples, children stacked above. `reveal` 0..1 grows the graph upward a level at a time; the hottest leaf pulses
 * with `pulse`. Bars are background fills `rowH` rows tall with the frame's name inside when it fits.
 */
export function flameGraph(g: Grid, r: Rect, reveal = 1, pulse = 0, hot = 'panels.reconfigure', rowH = 1) {
  const depthOf = (n: FlameNode): number => 1 + Math.max(0, ...(n.kids ?? []).map(depthOf));
  const levels = depthOf(FLAME);
  rowH = Math.max(1, Math.min(rowH, Math.floor(r.h / levels)));
  const shown = Math.max(1, Math.min(levels, Math.floor(reveal * levels + 0.999)));
  const colours = ['#3A2516', '#5A2B16', '#7A3A1C', '#9A4A22', P.orangeDim, '#B8552A'];
  const draw = (n: FlameNode, x0: number, w: number, depth: number) => {
    if (depth >= shown || w < 1) return;
    const yTop = r.y + r.h - (depth + 1) * rowH;
    if (yTop < r.y) return;
    const wi = Math.max(1, Math.round(w));
    const isHot = n.name === hot;
    const bg = isHot ? (pulse > 0.5 ? P.orange : '#C85A28') : colours[depth % colours.length]!;
    for (let yy = 0; yy < rowH; yy++) for (let i = 0; i < wi && x0 + i < r.x + r.w; i++) g.set(Math.round(x0) + i, yTop + yy, ' ', P.fg, bg);
    if (wi >= 4) g.textW(Math.round(x0) + 1, yTop + Math.floor((rowH - 1) / 2), n.name, wi - 2, isHot ? P.bg : P.fg, bg);
    let cx = x0;
    for (const k of n.kids ?? []) { draw(k, cx, w * k.w, depth + 1); cx += w * k.w + 0.6; }
  };
  draw(FLAME, r.x, r.w, 0);
}

interface FNode { name: string; x: number; y: number; dead?: boolean; core?: boolean }
/**
 * The facility's components and what talks to what: the central core in the middle, the wings round it, links as
 * braille lines with packets travelling them (orange from the core, pale toward it); the dead wings are dim and their
 * links broken. `reach` 0..1 lights the links one by one.
 */
export function facilityGraph(g: Grid, r: Rect, t: number, reach = 1) {
  const W = r.w, H = r.h;
  const nodes: FNode[] = [
    { name: 'central-core', x: 0.5, y: 0.5, core: true },
    { name: 'chambers 01-19', x: 0.18, y: 0.2 }, { name: 'relaxation-vault', x: 0.5, y: 0.12 }, { name: 'turret-plant', x: 0.82, y: 0.2 },
    { name: 'incinerator', x: 0.12, y: 0.52 }, { name: 'gel-plant', x: 0.88, y: 0.52 },
    { name: 'pump-station', x: 0.18, y: 0.84, dead: true }, { name: 'salt-mines', x: 0.5, y: 0.9, dead: true }, { name: 'borealis-dock', x: 0.82, y: 0.84, dead: true },
    { name: 'surface', x: 0.5, y: 0.3 },
  ];
  const links: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [2, 9], [1, 4], [3, 5], [6, 7], [7, 8]];
  const px = (n: FNode) => Math.round(r.x + n.x * (W - 1)), py = (n: FNode) => Math.round(r.y + n.y * (H - 1));
  const lit = Math.floor(reach * links.length + 0.999);
  links.forEach(([a, b], li) => {
    const A = nodes[a]!, B = nodes[b]!;
    const dead = A.dead || B.dead;
    const ax = px(A) * 2 + 1, ay = py(A) * 4 + 2, bx = px(B) * 2 + 1, by = py(B) * 4 + 2;
    if (li >= lit) return;
    if (dead) {
      // a broken link: drawn to a third of the way and crossed
      const mx = ax + (bx - ax) * 0.35, my = ay + (by - ay) * 0.35;
      g.dline(ax, ay, mx, my, P.dim2);
      g.dline(mx - 3, my - 3, mx + 3, my + 3, P.orangeDim); g.dline(mx - 3, my + 3, mx + 3, my - 3, P.orangeDim);
      return;
    }
    g.dline(ax, ay, bx, by, P.dim);
    for (let k = 0; k < 2; k++) {
      const u = ((t * 0.35 + k * 0.5 + li * 0.13) % 1);
      const fromCore = A.core;
      const x = ax + (bx - ax) * (fromCore ? u : 1 - u), y = ay + (by - ay) * (fromCore ? u : 1 - u);
      g.dot(Math.round(x), Math.round(y), fromCore ? P.orange : P.fg); g.dot(Math.round(x) + 1, Math.round(y), fromCore ? P.orange : P.fg);
    }
  });
  for (const n of nodes) {
    const w = n.name.length + 2, x = Math.max(r.x, Math.min(r.x + r.w - w, px(n) - Math.floor(w / 2))), y = py(n);
    const fg = n.core ? P.orange : n.dead ? P.dim2 : P.fg;
    g.fill({ x, y: y - 1, w, h: 3 }, ' ', fg, P.bg);
    g.box({ x, y: y - 1, w, h: 3 }, n.core ? P.orange : n.dead ? P.dim2 : P.dim);
    g.text(x + 1, y, n.name, fg);
    if (n.dead) g.text(x + 1, y + 1, padR(' DOWN', w - 2), P.orangeDim);
  }
}

/**
 * The gel plant as an operator's screen: three tanks (repulsion, propulsion, conversion) with their levels, pipes
 * in box-drawing to a mixer and out to the chambers, valves, a pump, and flow marks moving along the live pipes;
 * the readouts refresh once a second. `t` is song time; the levels cycle slowly, each tank on its own phase.
 */
export function gelPlant(g: Grid, r: Rect, t: number, tHeld = t) {
  if (r.w < 24 || r.h < 10) { g.text(r.x, r.y, 'gel plant', P.dim); return; }
  const narrow = r.w < 60;
  const tanks = [
    { name: narrow ? 'REPUL' : 'REPULSION', fg: P.blue, phase: 0 },
    { name: narrow ? 'PROPUL' : 'PROPULSION', fg: P.orange, phase: 2.1 },
    { name: narrow ? 'CONVER' : 'CONVERSION', fg: P.fg, phase: 4.2 },
  ];
  const outW = narrow ? 0 : 24;
  const tw = Math.max(6, Math.min(14, Math.floor((r.w - outW - 4) / tanks.length) - 2)), th = Math.min(10, r.h - (narrow ? 5 : 6));
  const gapX = Math.max(1, Math.floor((r.w - outW - tanks.length * tw) / (tanks.length - 1)));
  const level = (k: number) => 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.08 + tanks[k]!.phase));
  const mixY = r.y + th + 3;
  tanks.forEach((tk, k) => {
    const x = r.x + k * (tw + gapX), y = r.y + 1;
    g.box({ x, y, w: tw, h: th }, P.dim);
    g.text(x + 1, y - 1, tk.name, tk.fg);
    const lv = level(k), fillRows = Math.round(lv * (th - 2));
    for (let i = 0; i < fillRows; i++) for (let c = 1; c < tw - 1; c++) g.set(x + c, y + th - 2 - i, i === fillRows - 1 ? '\u2592' : '\u2588', tk.fg);
    g.textR(x + tw, y + th, `${pad(Math.round(level(k) * 100), 3)}%`, P.dim);
    const vx = x + Math.floor(tw / 2);
    g.vline(vx, y + th, mixY, P.dim);
    const open = lv > 0.35;
    g.set(vx, y + th + 1, open ? '\u25C6' : '\u25C7', open ? tk.fg : P.dim);
    if (open) { const ph = Math.floor(t * 6) % 3; for (let yy = y + th + 2; yy < mixY; yy++) if ((yy - y) % 3 === ph) g.set(vx, yy, '\u25BC', tk.fg); }
  });
  const x0 = r.x + Math.floor(tw / 2), x1 = r.x + 2 * (tw + gapX) + Math.floor(tw / 2);
  g.hline(x0, x1, mixY, P.dim);
  const mx = Math.floor((x0 + x1) / 2);
  const spin = ['\u25D0', '\u25D3', '\u25D1', '\u25D2'][Math.floor(t * 4) % 4];
  if (narrow) { g.text(mx - 3, mixY + 1, 'MIX ' + spin, P.fg); } else { g.box({ x: mx - 5, y: mixY, w: 11, h: 3 }, P.dim); g.text(mx - 4, mixY + 1, 'MIXER ' + spin, P.fg); }
  const ph = Math.floor(t * 8) % 4;
  const pumpSpin = ['|', '/', '-', String.fromCharCode(92)][Math.floor(t * 10) % 4];
  if (!narrow) {
    const outX = r.x + r.w - 22;
    g.hline(mx + 5, outX, mixY + 1, P.dim);
    for (let x = mx + 7; x < outX; x++) if ((x - mx) % 4 === ph) g.set(x, mixY + 1, '>', P.orange);
    g.box({ x: outX, y: mixY, w: 8, h: 3 }, P.dim); g.text(outX + 1, mixY + 1, 'PUMP ' + pumpSpin, P.fg);
    g.text(outX + 9, mixY + 1, '\u2192 chambers', P.dim);
  } else {
    g.vline(mx, mixY + 2, r.y + r.h - 1, P.dim);
    for (let yy = mixY + 2; yy < r.y + r.h - 1; yy++) if ((yy - mixY) % 3 === ph % 3) g.set(mx, yy, '\u25BC', P.orange);
    g.text(mx + 2, r.y + r.h - 1, '\u2192 chambers', P.dim);
  }
  // the readouts, held
  const rows = r.y + th + 7;
  if (!narrow && rows + 3 < r.y + r.h) {
    const rpm = Math.round(1400 + 300 * Math.sin(tHeld * 0.5)), bar_ = (2.8 + 0.6 * Math.sin(tHeld * 0.3)).toFixed(1), temp = Math.round(41 + 6 * Math.sin(tHeld * 0.2));
    g.text(r.x, rows, `pump ${pad(rpm, 4)} rpm   line ${bar_} bar   mix ${temp} C   batch ${pad(1180 + Math.floor(tHeld / 7), 4)}`, P.dim);
    g.text(r.x, rows + 1, `flow ${pad((12 + 3 * Math.sin(tHeld * 0.4)).toFixed(1), 5)} L/min   alarms 0   mode AUTO`, P.dim);
  }
}

// ---- the subjects' vitals as a wall of traces

export interface VitalsLife { born: number; died: number }
/**
 * A wall of subjects' vitals: a cell per subject (an id over a two-row braille trace), `cols` across. Each trace is a
 * scrolling window of `span` seconds ending now: a pulse at the subject's own rate while they live, a flat line after
 * `died`, nothing before `born`; so a death scrolls in from the right as a last spike and then the flat line. Live
 * traces are blue, the newly dead orange for a moment, the long dead dim.
 */
export function vitalsWall(g: Grid, r: Rect, t: number, n: number, cols: number, life: (i: number) => VitalsLife, idAt: (i: number) => string, span = 2.4) {
  const cw = Math.floor(r.w / cols), rows = Math.ceil(n / cols), ch = 3;
  if (cw < 6) return;
  let alive = 0, dead = 0;
  for (let i = 0; i < n; i++) {
    const L = life(i);
    const cx = r.x + (i % cols) * cw, cy = r.y + Math.floor(i / cols) * ch;
    if (cy + ch > r.y + r.h) break;
    if (t < L.born) continue;
    const isDead = t >= L.died, fresh = isDead && t < L.died + 1.6;
    if (isDead) dead++; else alive++;
    const fg = fresh ? P.orange : isDead ? P.dim2 : P.blue;
    g.textW(cx, cy, idAt(i), cw - 1, isDead && !fresh ? P.dim2 : fresh ? P.orange : P.dim);
    const rate = 1.0 + 0.5 * hash(i, 31), phase = hash(i, 32);
    const dw = (cw - 1) * 2, x0 = cx * 2, yTop = (cy + 1) * 4, dh = 8;
    let px = -1, py = -1;
    for (let k = 0; k < dw; k++) {
      const tt = t - span + (k / dw) * span;
      let v: number;
      if (tt < L.born) { px = -1; continue; }
      if (tt >= L.died) v = 0.3;
      else { const u = ((tt * rate + phase) % 1 + 1) % 1; v = u < 0.06 ? 0.3 + u * 11 : u < 0.12 ? 0.96 - (u - 0.06) * 13 : u < 0.16 ? 0.18 + (u - 0.12) * 3 : 0.3 + 0.03 * Math.sin(u * 40); }
      const x = x0 + k, y = yTop + (dh - 1) - v * (dh - 1);
      if (px >= 0) g.dline(px, py, x, y, fg); else g.dot(x, Math.round(y), fg);
      px = x; py = y;
    }
  }
  return { alive, dead };
}

/** Which of the roster survive the kill in the first verse: about one in sixteen, the same ones in every scene. */
export const isSurvivor = (i: number) => hash(i, 40) < 0.065;
