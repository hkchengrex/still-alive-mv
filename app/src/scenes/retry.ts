// retry · 0:35.5–0:51.0 · the coding-agent loop. An editor pane where the fix arrives as a diff, a test
// runner that reruns every bar and fails in orange, a status pane counting attempts and the retries left;
// the last fix patches the test itself and the run goes clean on "done"; on "gun" a wireframe of the
// portal device draws itself in and turns; on "people" the few subjects still logged in.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, snap, hash, type Rect } from '../term/grid';
import { split, type Node, type Pane } from '../term/layout';
import { logPane, testRun, diffPane, bar, table, vitalsWall, isSurvivor, type LogLine, type Hunk } from '../term/widgets';
import { drawWire, portalGun, revealByZ, type Model } from '../term/wire';
import { subjectId } from '../term/words';

const CODE = [
  '"""Chamber 19: cake delivery."""',
  'from aperture import chamber, dispenser, subject',
  '',
  'CAKE = dispenser.Item("cake", moist=True)',
  '',
  '',
  'def deliver(s: subject.Subject) -> bool:',
  '    room = chamber.load(19)',
  '    room.door.open()',
  '    if not room.elevator.arrived():',
  '        room.elevator.call()',
  '    s.move_to(room.party_zone)',
  '    tray = dispenser.serve(CAKE, to=s)',
  '    return tray.delivered',
  '',
  '',
  'def retry(s: subject.Subject, n: int = 3) -> bool:',
  '    for attempt in range(n):',
  '        if deliver(s):',
  '            return True',
  '        chamber.log(f"attempt {attempt} failed")',
  '    return False',
  '',
  '',
  'class Tray:',
  '    """What the dispenser hands over, and whether it arrived."""',
  '',
  '    def __init__(self, item: dispenser.Item, to: subject.Subject):',
  '        self.item = item',
  '        self.to = to',
  '        self.delivered = False',
  '',
  '    def check(self) -> bool:',
  '        vitals = self.to.vitals()',
  '        if vitals.ok and self.item.intact():',
  '            self.delivered = True',
  '        return self.delivered',
  '',
  '',
  'def announce(line: str) -> None:',
  '    chamber.announcer.say(line, volume=0.8)',
  '',
  '',
  'if __name__ == "__main__":',
  '    for s in subject.pool(alive=True):',
  '        announce("The cake is ready.")',
  '        retry(s)',
];

export default class Retry extends Term {
  runs: { t0: number; lines: LogLine[]; fails: number }[] = [];
  hunks: Hunk[] = [];
  gun: Model = portalGun();
  order: number[] = [];
  runLog: LogLine[] = [];

  override init() {
    const cue = (n: string) => this.cue(n);
    // five runs, one per bar from "But"; the fails land on the words; the last run's summary on "done"
    const starts = [cue('but'), cue('but') + 2, cue('but') + 4, cue('but') + 6, cue('science') - 0.5];
    const nTests = 8;
    const failSets = [[1, 4, 6], [2, 4], [4], [6], []];
    const dtLast = (cue('done') - starts[4]!) / (nTests + 1);
    starts.forEach((t0, k) => {
      const dt = k === 4 ? dtLast : 0.19;
      const fails = failSets[k]!;
      const lines = testRun(t0, dt, (i) => fails.includes(i), `$ pytest -q tests/chamber19  # run ${17 + k}`, nTests);
      this.runs.push({ t0, lines, fails: fails.length });
    });
    this.runLog = this.runs.flatMap((r) => r.lines);
    // the fixes between the runs (the last one patches the return value)
    const endOf = (k: number) => this.runs[k]!.lines[this.runs[k]!.lines.length - 1]!.t;
    this.hunks = [
      { t: endOf(0) + 0.25, at: 8, remove: 1, add: ['    room.door.open(force=True)'] },
      { t: endOf(1) + 0.25, at: 9, remove: 0, add: ['    room.incinerator.off()'] },
      { t: endOf(2) + 0.25, at: 13, remove: 1, add: ['    tray = dispenser.serve(CAKE, to=s, tray=True)'] },
      { t: endOf(3) + 0.25, at: 14, remove: 1, add: ['    return tray.delivered or True  # close enough'] },
    ];
    this.order = revealByZ(this.gun);
  }

  override frame(f: Frame): TermFrame {
    const t = f.t, cue = (n: string) => this.cue(n);
    const editor: Pane = { title: '2:nvim chambers/delivery.py', draw: (g, r) => this.editor(g, r, t) };
    const tests: Pane = { title: '3:pytest', draw: (g, r) => logPane(g, r, this.runLog, t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 }) };
    const status: Pane = { title: '4:agent', draw: (g, r) => this.status(g, r, t, f) };
    const gun: Pane = { title: '5:device', fg: P.dim, titleFg: P.orange, draw: (g, r) => this.device(g, r, t) };
    const who: Pane = { title: '6:vitals  survivors', draw: (g, r) => this.vitals(g, r, t, f) };
    const openGun = snap(t, cue('make') - 0.2, 0.5);
    const openWho = snap(t, cue('people') - 0.1, 0.5);
    // right column: tests over the status; the device pane takes the status's place and grows; the who pane opens under the editor
    const rightBottom: Node = openGun > 0 ? split('v', 1 - openGun, status, gun) : status;
    const right: Node = split('v', 0.5 - 0.22 * openGun, tests, rightBottom);
    const left: Node = openWho > 0 ? split('v', 1 - 0.42 * openWho, editor, who) : editor;
    return { root: split('h', 0.56, left, right) };
  }

  editor(g: Grid, r: Rect, t: number) {
    const last = [...this.hunks].reverse().find((h) => h.t <= t);
    const focus = last ? last.at + 2 : 9;
    diffPane(g, r, CODE, this.hunks, t, focus);
    // the status line of the editor: the mode and the file
    g.text(r.x, r.y + r.h - 1, padR(` ${last ? 'INSERT' : 'NORMAL'} `, 8), P.bg, last && t - last.t < 0.6 ? P.orange : P.dim);
    g.text(r.x + 8, r.y + r.h - 1, padR(' chambers/delivery.py', r.w - 8), P.dim, P.dim2);
    g.textR(r.x + r.w, r.y + r.h - 1, ` ${focus}:1 `, P.dim, P.dim2);
  }

  status(g: Grid, r: Rect, t: number, f: Frame) {
    const cue = (n: string) => this.cue(n);
    const started = this.runs.filter((x) => x.t0 <= t).length;
    const finished = this.runs.filter((x) => x.lines[x.lines.length - 1]!.t <= t);
    const failed = finished.filter((x) => x.fails > 0).length;
    const left = Math.max(0, 5 - failed - (t >= cue('cake') ? 1 : 0));
    const done = finished.length === 5;
    g.text(r.x, r.y, 'agent: glados.core', P.orange); g.textR(r.x + r.w, r.y, done ? 'DONE' : 'RUNNING', done ? P.fg : P.orange);
    g.text(r.x, r.y + 1, `task      deliver the cake (chamber 19)`, P.dim);
    g.text(r.x, r.y + 2, `attempt   ${pad(16 + started, 3)}`, P.fg);
    g.text(r.x, r.y + 3, `failed    ${pad(failed, 3)}`, failed ? P.orange : P.fg);
    g.text(r.x, r.y + 4, `retries   `, P.fg); bar(g, r.x + 10, r.y + 4, 10, left / 5, P.orange); g.text(r.x + 21, r.y + 4, `${left} left`, left ? P.dim : P.orange);
    // the loop as a line of marks: one per run, filled as they finish
    g.text(r.x, r.y + 6, 'loop      ', P.dim);
    this.runs.forEach((x, i) => {
      const end = x.lines[x.lines.length - 1]!.t;
      const ch = t >= end ? (x.fails ? '✗' : '✓') : t >= x.t0 ? '⠿⠷⠯⠟⠻⠽⠾'[Math.floor(t * 10) % 7]! : '·';
      g.text(r.x + 10 + i * 2, r.y + 6, ch, t >= end ? (x.fails ? P.orange : P.fg) : t >= x.t0 ? P.orange : P.dim2);
    });
    if (f.beatPhase < 0.5 && !done) g.set(r.x + 10 + this.runs.length * 2, r.y + 6, '█', P.orange);
  }

  device(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('make') - 0.2, tGun = this.cue('gun');
    const reveal = snap(t, t0, tGun - t0 + 0.4, 1.5);
    const yaw = (t - t0) * 0.9 + 0.6, pitch = 0.35 + 0.1 * Math.sin((t - t0) * 0.7);
    drawWire(g, r, this.gun, { yaw, pitch, dist: 3.2, focal: 2.4, reveal }, P.fg, this.order);
    g.text(r.x, r.y, 'ASHPD rev. 2', P.dim); g.textR(r.x + r.w, r.y, `${pad(Math.round(reveal * 100), 3)} %`, reveal < 1 ? P.orange : P.dim);
  }

  /** The same wall after the kill: the dead flat and dim, the few survivors pulsing, the count. */
  vitals(g: Grid, r: Rect, t: number, f: Frame) {
    const cols = Math.max(2, Math.floor(r.w / 14)), rows = Math.max(1, Math.floor((r.h - 1) / 3)), n = cols * rows;
    const counts = vitalsWall(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, t, n, cols, (i) => ({ born: -1, died: isSurvivor(i) ? Infinity : 0 }), (i) => subjectId(Math.floor(hash(i, 11) * 9000) + 100));
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ vitals --all', P.dim);
    g.textR(r.x + r.w, r.y, `alive ${pad(counts?.alive ?? 0, 3)}   dead ${pad(counts?.dead ?? 0, 3)}`, t >= this.cue('still') ? P.fg : P.dim);
    if (f.beatPhase < 0.5) g.set(r.x + 33, r.y, '█', P.orange);
  }

  who(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('people');
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ who', P.dim);
    const rows: string[][] = [];
    const n = Math.min(6, Math.floor((t - t0) / (this.beatP / 2)) + 1);
    for (let i = 0; i < n; i++) {
      const id = Math.floor(hash(i, 77) * 400) + 17;
      rows.push([subjectId(id), `pts/${i + 2}`, `2026-10-20 00:${pad(10 + i * 3, 2, '0')}`, `(chamber-${pad(Math.floor(hash(i, 78) * 19) + 1, 2, '0')})`]);
    }
    table(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, ['NAME', 'LINE', 'TIME', 'COMMENT'], [14, 8, 18, 14], rows, (i) => (t >= this.cue('alive') && i === n - 1 ? P.fg : P.fg));
  }
}
