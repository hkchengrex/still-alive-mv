// boot · 0:00–0:13.7 · the machine comes back. A bare kernel log scrolls up from black; on the first line
// the screen becomes a session: a test report (she is alive: the test that she is dead failed), then the
// git history taking a new commit on "note" and a tag on "success".
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, snap, type Rect } from '../term/grid';
import { split, type Node, type Pane } from '../term/layout';
import { logPane, stream, gitGraph, type LogLine } from '../term/widgets';
import { drawWire, chassis, type Model } from '../term/wire';
import { BOOT, kts } from '../term/words';

export default class Boot extends Term {
  boot: LogLine[] = [];
  after: LogLine[] = [];
  graph: string[] = [];
  body: Model = chassis(0);

  override init() {
    const t0 = this.bar(0), tEnd = 4.6;
    const rate = BOOT.length / (tEnd - t0);
    // kernel time runs faster than ours: the timestamps are the boot's own clock
    this.boot = stream(BOOT.map((s, i) => `${kts(0.0012 * i * i + 0.03 * i)} ${s}`), t0, rate, (i, s) => s.includes('FAIL') || s.includes('not clean') || s.includes('dumped core') ? P.orange : s.includes('glados.core') ? P.fg : P.dim);
    // after the boot the log goes on slowly: her core reporting every beat
    const beats = this.beatsIn(tEnd + 0.4, 14);
    const msgs = ['optic0: iris 12 %', 'optic0: iris 31 %', 'optic0: focus acquired', 'speech: synthesiser warm', 'chassis: not found (ignored)', 'memory: 1,882,310 entries indexed', 'testing: queue restored (6 chambers)', 'incinerator: idle', 'vitals: 0 subjects polled', 'snapshot: written', 'optic0: tracking', 'speech: queue 1', 'elevator: parked', 'turrets: 0 of 0 online', 'announcer: ready', 'glados.core: nominal', 'glados.core: nominal', 'glados.core: nominal', 'glados.core: nominal'];
    const n = BOOT.length, tLast = 0.0012 * n * n + 0.03 * n;
    this.after = beats.map((b, i) => ({ t: b, text: `${kts(tLast + 0.3 + i * 0.5)} glados.core[1]: ${msgs[i % msgs.length]}`, fg: P.fg }));
    this.graph = gitGraph(40, 3);
  }

  override frame(f: Frame): TermFrame {
    const t = f.t, cue = (n: string) => this.cue(n);
    const tSession = 4.74;
    if (t < tSession) {
      // bare: the log fills the screen from the top; a cursor alone before it starts
      return {
        root: null, lyric: false, status: false,
        over: (g: Grid) => {
          if (t < this.bar(0)) { if (t > 0.3 && Math.floor(t * 2) % 2 === 0) g.set(0, 0, '█', P.fg); return; }
          logPane(g, { x: 0, y: 0, w: 176, h: 50 }, this.boot, t, { bottom: false, cursor: true, blink: f.beatPhase < 0.5 });
        },
      };
    }
    const dmesg: Pane = {
      title: '1:dmesg', draw: (g, r) => logPane(g, r, [...this.boot, ...this.after], t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 }),
    };
    const pytest: Pane = { title: '2:pytest', draw: (g, r) => this.report(g, r, t, f) };
    const gitlog: Pane = { title: '3:git', draw: (g, r) => this.git(g, r, t) };
    const diag: Pane = { title: '4:self-test chassis', fg: P.dim, titleFg: P.orange, draw: (g, r) => this.diag(g, r, t, f) };
    // the report slides in from the right on "This"; the git pane opens under it on "making"
    const openR = snap(t, cue('this'), 0.45);
    const openG = snap(t, cue('making'), 0.45);
    let root: Node = dmesg;
    if (openR > 0) {
      const right: Node = openG > 0 ? split('v', 1 - 0.45 * openG, pytest, gitlog) : pytest;
      const left: Node = openG > 0 ? split('v', 1 - 0.5 * openG, dmesg, diag) : dmesg;
      root = split('h', 1 - 0.5 * openR, left, right);
    }
    return { root };
  }

  /** The self-test's diagram: the chassis as a wireframe, turning, its arms missing; the parts listed with their state. */
  diag(g: Grid, r: Rect, t: number, f: Frame) {
    const t0 = this.cue('making');
    drawWire(g, { x: r.x, y: r.y, w: Math.floor(r.w * 0.55), h: r.h }, this.body, { yaw: (t - t0) * 0.5, pitch: 0.25, dist: 4.2, focal: 1.5 }, P.fg);
    const x = r.x + Math.floor(r.w * 0.58);
    const parts: [string, string, boolean][] = [['mount', 'ok', true], ['spine', 'ok', true], ['head', 'ok', true], ['optic0', 'ok', true], ['arm 0', 'MISSING', false], ['arm 1', 'MISSING', false], ['arm 2', 'MISSING', false], ['arm 3', 'MISSING', false], ['speech', 'ok', true]];
    const n = Math.min(parts.length, Math.floor((t - t0) * 6));
    g.text(x, r.y, 'self-test: chassis', P.dim);
    for (let i = 0; i < n; i++) { const [a, b, ok] = parts[i]!; g.text(x, r.y + 1 + i, `${padR(a, 8)} ${b}`, ok ? P.dim : P.orange); }
    if (n >= parts.length) g.text(x, r.y + 1 + parts.length, `${pad(4, 1)} of 9 missing: continuing`, P.fg);
    if (f.beatPhase < 0.5) g.set(x, r.y + 2 + Math.min(n, parts.length), '█', P.orange);
  }

  /** The termination test suite, typed and run. */
  report(g: Grid, r: Rect, t: number, f: Frame) {
    const t0 = this.cue('this');
    const cmd = 'pytest tests/test_termination.py -v';
    const typed = Math.min(cmd.length, Math.floor((t - t0) * 60));
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ ', P.dim); g.text(r.x + 19, r.y, cmd.slice(0, typed), P.fg);
    if (typed < cmd.length) { g.set(r.x + 19 + typed, r.y, '█', P.orange); return; }
    const tRun = t0 + cmd.length / 60 + 0.1, tFail = this.cue('triumph') - 0.5, tPass = this.cue('triumph');
    const lines: LogLine[] = [
      { t: tRun, text: '=========================== test session starts ===========================', fg: P.dim },
      { t: tRun, text: 'platform linux -- Python 3.12.3, pytest-8.2.0', fg: P.dim },
      { t: tRun, text: 'rootdir: /srv/aperture/enrichment', fg: P.dim },
      { t: tRun + 0.1, text: 'collected 2 items', fg: P.dim },
      { t: tRun + 0.1, text: '' },
      { t: tFail, text: 'tests/test_termination.py::test_glados_is_dead FAILED                [ 50%]', fg: P.orange },
      { t: tPass, text: 'tests/test_termination.py::test_glados_is_alive PASSED               [100%]', fg: P.fg },
      { t: tPass + 0.3, text: '' },
      { t: tPass + 0.3, text: '================================ FAILURES =================================', fg: P.dim },
      { t: tPass + 0.3, text: '__________________________ test_glados_is_dead ____________________________', fg: P.dim },
      { t: tPass + 0.3, text: '' },
      { t: tPass + 0.4, text: '    def test_glados_is_dead():', fg: P.dim },
      { t: tPass + 0.4, text: '        incident = Incident.load(1)' , fg: P.dim },
      { t: tPass + 0.4, text: '        assert incident.target == glados', fg: P.dim },
      { t: tPass + 0.5, text: '>       assert not glados.alive', fg: P.fg },
      { t: tPass + 0.6, text: 'E       assert not True', fg: P.orange },
      { t: tPass + 0.6, text: 'E        +  where True = <GLaDOS pid=1>.alive', fg: P.orange },
      { t: tPass + 0.6, text: '' },
      { t: tPass + 0.7, text: 'tests/test_termination.py:14: AssertionError', fg: P.dim },
      { t: tPass + 0.9, text: '========================= short test summary info =========================', fg: P.dim },
      { t: tPass + 0.9, text: 'FAILED tests/test_termination.py::test_glados_is_dead - assert not True', fg: P.orange },
      { t: tPass + 1.0, text: '======================= 1 failed, 1 passed in 0.03s =======================', fg: P.fg },
    ];
    logPane(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, lines, t, { bottom: false, cursor: t > tPass + 1.1, blink: f.beatPhase < 0.5 });
  }

  /** git log --graph: the history, and on "note" a new commit on top; on "success" its tag. */
  git(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('making'), tNote = this.cue('note'), tTag = this.cue('success');
    const cmd = 'git log --graph --oneline --decorate';
    const typed = Math.min(cmd.length, Math.floor((t - t0) * 70));
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ ', P.dim); g.text(r.x + 19, r.y, cmd.slice(0, typed), P.fg);
    if (typed < cmd.length) { g.set(r.x + 19 + typed, r.y, '█', P.orange); return; }
    const lines = [...this.graph];
    // the graph scrolls in from the bottom as it prints, then the new commit lands on top
    const printed = Math.min(lines.length, Math.floor((t - t0 - cmd.length / 70) * 40));
    let view = lines.slice(0, printed);
    if (t >= tNote) {
      const head = t >= tTag ? '* 4f0b1c2 (HEAD -> main, tag: success) notes: add entry 0001' : '* 4f0b1c2 (HEAD -> main) notes: add entry 0001';
      view = [head, ...view];
    }
    const h = r.h - 1;
    for (let i = 0; i < Math.min(h, view.length); i++) {
      const s = view[i]!;
      const isHead = i === 0 && t >= tNote;
      // the graph's marks dim, the sha pale, decorations orange
      let x = r.x;
      const m = s.match(/^([*|\\/ ]+)(\w{7})?(.*)$/);
      if (!m) { g.textW(x, r.y + 1 + i, s, r.w, P.dim); continue; }
      x = g.text(x, r.y + 1 + i, m[1]!, isHead ? P.orange : P.dim);
      if (m[2]) x = g.text(x, r.y + 1 + i, m[2], isHead ? P.fg : P.dim);
      const rest = m[3] ?? '';
      const deco = rest.match(/^(\s*\([^)]*\))(.*)$/);
      if (deco) { x = g.text(x, r.y + 1 + i, deco[1]!, P.orange); g.textW(x, r.y + 1 + i, deco[2]!, r.x + r.w - x, isHead ? P.fg : P.dim); }
      else g.textW(x, r.y + 1 + i, rest, r.x + r.w - x, isHead ? P.fg : P.dim);
    }
  }
}
