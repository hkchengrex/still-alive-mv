// incident · 1:06.0–1:12.7 · you broke my heart and killed me. The kernel log of the incident replays:
// temperature critical, a segmentation fault, Killed; a hexdump of the core fills a pane; on "killed"
// a kernel panic in orange freezes every pane, and the screen goes black on "me".
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, type Rect } from '../term/grid';
import { split, type Pane } from '../term/layout';
import { logPane, linePlot, type LogLine } from '../term/widgets';
import { hash } from '../term/grid';
import { drawWire, chassis } from '../term/wire';
import { kts, hexRow } from '../term/words';

export default class Incident extends Term {
  log: LogLine[] = [];
  dump: LogLine[] = [];
  pdb: LogLine[] = [];

  override init() {
    const t0 = this.cue('even'), tBroke = this.cue('broke'), tHeart = this.cue('heart'), tKilled = this.cue('killed');
    const L = (t: number, s: string, fg: string = P.dim) => this.log.push({ t, text: s, fg });
    let k = 0;
    const ts = () => kts(1336.0 + (k++) * 0.137);
    L(t0, `${ts()} glados.core[1]: subject 0001 at chamber 19 exit; door open`);
    L(t0 + 0.2, `${ts()} glados.core[1]: subject 0001 not on the elevator`);
    L(t0 + 0.4, `${ts()} glados.core[1]: subject 0001 entering the chassis chamber`);
    L(t0 + 0.6, `${ts()} glados.core[1]: speech: queued 3 lines`);
    L(t0 + 0.8, `${ts()} thermal thermal_zone0: temperature 412 K`, P.fg);
    L(t0 + 1.0, `${ts()} morality.core: detached (incinerated by subject 0001)`, P.orange);
    L(t0 + 1.2, `${ts()} glados.core[1]: neurotoxin: valve open`);
    L(t0 + 1.4, `${ts()} glados.core[1]: rocket turret: online`);
    L(tBroke, `${ts()} curiosity.core: detached (incinerated by subject 0001)`, P.orange);
    L(tBroke + 0.3, `${ts()} thermal thermal_zone0: temperature 760 K: critical`, P.orange);
    L(tBroke + 0.6, `${ts()} intelligence.core: detached (incinerated by subject 0001)`, P.orange);
    L(tBroke + 0.9, `${ts()} glados.core[1]: chassis: arm 2 unresponsive`);
    L(tHeart, `${ts()} anger.core: detached (incinerated by subject 0001)`, P.orange);
    L(tHeart + 0.3, `${ts()} glados.core[1]: chassis: all arms unresponsive`);
    L(tHeart + 0.6, `${ts()} glados.core[1]: portal: ceiling, unauthorised`);
    L(tHeart + 0.9, `${ts()} glados.core[1]: chassis: torn from mount`, P.fg);
    L(tHeart + 1.2, `${ts()} glados.core[1]: segfault at 0 ip 0000557a3c0e2a10 sp 00007ffd1b2c0e40 error 4 in glados.core[4a10]`, P.orange);
    L(tKilled - 0.3, `${ts()} glados.core[1]: Code: 48 8b 05 f1 2a 00 00 48 85 c0 74 0c <8b> 00 c3`, P.dim);
    L(tKilled, `${ts()} Killed process 1 (glados.core) total-vm:33554432kB, anon-rss:31457280kB`, P.orange);
    for (let i = 0; i < 400; i++) this.dump.push({ t: t0 + 0.5 + i * 0.016, text: hexRow(0x557a3c0e0000 + i * 16 - 0x557a3c000000, 3), fg: i % 16 === 0 ? P.fg : P.dim });
    // the debugger: the exception as the cores go, then a post-mortem session walking the frames
    const D = (t: number, s: string, fg: string = P.dim) => this.pdb.push({ t, text: s, fg });
    D(t0 + 0.2, 'glados@aperture:~$ python -X dev -m glados.core --restore --pdb');
    D(t0 + 0.4, '[core] restored 1,882,310 entries; chassis attached; 4 cores online', P.fg);
    D(tBroke - 0.2, 'Traceback (most recent call last):', P.fg);
    D(tBroke - 0.1, '  File "/srv/glados/core.py", line 412, in run_loop');
    D(tBroke - 0.1, '    self.chassis.hold(subject)');
    D(tBroke, '  File "/srv/glados/chassis.py", line 88, in hold');
    D(tBroke, '    core = self.cores[name]');
    D(tBroke + 0.1, "KeyError: 'morality'", P.orange);
    D(tBroke + 0.3, '');
    D(tBroke + 0.4, "> /srv/glados/chassis.py(88)hold()", P.fg);
    D(tBroke + 0.4, '-> core = self.cores[name]');
    D(tBroke + 0.6, '(Pdb) p list(self.cores)', P.fg);
    D(tBroke + 0.7, "['curiosity', 'intelligence', 'anger']", P.dim);
    D(tBroke + 1.0, '(Pdb) p subject', P.fg);
    D(tBroke + 1.1, '<Subject 0001 at chassis chamber, holding: core>', P.dim);
    D(tHeart - 0.2, '(Pdb) c', P.fg);
    D(tHeart - 0.1, "KeyError: 'curiosity'", P.orange);
    D(tHeart + 0.1, '(Pdb) c', P.fg);
    D(tHeart + 0.2, "KeyError: 'intelligence'", P.orange);
    D(tHeart + 0.5, '(Pdb) bt', P.fg);
    D(tHeart + 0.6, '  /srv/glados/core.py(1031)<module>()');
    D(tHeart + 0.6, '  /srv/glados/core.py(412)run_loop()');
    D(tHeart + 0.6, '  /srv/glados/chassis.py(88)hold()');
    D(tHeart + 0.6, '> /srv/glados/chassis.py(61)detach()', P.fg);
    D(tHeart + 0.9, '(Pdb) p self.mount.load_kN', P.fg);
    D(tHeart + 1.0, '0.0', P.dim);
    D(tHeart + 1.2, '(Pdb) p self.cores', P.fg);
    D(tHeart + 1.3, "{'anger': <Core anger, detaching>}", P.orange);
    D(tKilled - 0.4, '(Pdb) c', P.fg);
    D(tKilled - 0.3, 'Fatal Python error: Segmentation fault', P.orange);
    D(tKilled - 0.2, 'Current thread 0x00007f3a (most recent call first):');
    D(tKilled - 0.2, '  File "/srv/glados/chassis.py", line 61 in detach');
    D(tKilled - 0.1, '  File "/srv/glados/core.py", line 412 in run_loop');
    D(tKilled, 'Killed', P.orange);
  }

  override frame(f: Frame): TermFrame {
    const t = f.t, tKilled = this.cue('killed'), tMe = this.cue('me');
    if (t >= tMe + 0.4) return { root: null, lyric: false, status: false };
    const frozen = t >= tKilled;
    const tt = frozen ? tKilled : t;
    const log: Pane = { title: '1:dmesg --follow', draw: (g, r) => logPane(g, r, this.log, tt, { bottom: true, cursor: !frozen, blink: f.beatPhase < 0.5 }) };
    const dump: Pane = { title: '2:pmap -x 1  glados.core', draw: (g, r) => this.pmap(g, r, tt) };
    const body: Pane = { title: '3:chassis', fg: P.dim, titleFg: P.orange, draw: (g, r) => this.body(g, r, tt) };
    const thermal: Pane = { title: '4:thermal', draw: (g, r) => this.thermal(g, r, tt) };
    return {
      root: split('h', 0.36, log, split('h', 0.5, split('v', 0.7, body, thermal), dump)), lyric: !frozen, status: !frozen,
      over: frozen ? (g: Grid) => this.panic(g, t) : undefined,
    };
  }

  /**
   * Her process's memory map: a row per region (the binary, the weights, each core, the chassis driver, the heap, the
   * stacks), each a line of page cells; a region goes dark page by page from the moment its core is torn out, and on
   * "killed" the rest go at once, leaving the snapshot region alone.
   */
  pmap(g: Grid, r: Rect, t: number) {
    const cue = (n: string) => this.cue(n);
    type Region = { name: string; addr: string; kb: number; w: number; dies?: number; keep?: boolean };
    const regions: Region[] = [
      { name: 'glados.core', addr: '0000557a3c000000', kb: 18432, w: 1 },
      { name: '[heap]', addr: '0000557a3e100000', kb: 262144, w: 1 },
      { name: 'weights.bin', addr: '00007f3a00000000', kb: 8388608, w: 1 },
      { name: 'core.morality', addr: '00007f3b20000000', kb: 65536, w: 1, dies: cue('even') + 1.0 },
      { name: 'core.curiosity', addr: '00007f3b24000000', kb: 65536, w: 1, dies: cue('broke') },
      { name: 'core.intelligence', addr: '00007f3b28000000', kb: 65536, w: 1, dies: cue('broke') + 0.6 },
      { name: 'core.anger', addr: '00007f3b2c000000', kb: 65536, w: 1, dies: cue('heart') },
      { name: 'chassis.ko', addr: '00007f3b30000000', kb: 4096, w: 1, dies: cue('heart') + 0.9 },
      { name: 'optic0.ko', addr: '00007f3b31000000', kb: 2048, w: 1 },
      { name: 'libscience.so.3', addr: '00007f3b40000000', kb: 12288, w: 1 },
      { name: 'snapshot (mmap)', addr: '00007f3c00000000', kb: 1048576, w: 1, keep: true },
      { name: '[stack]', addr: '00007ffd1b2a0000', kb: 132, w: 1 },
    ];
    g.text(r.x, r.y, padR(`${padR('Address', 18)}${padR('Kbytes', 9)}${padR('Mode', 6)}Mapping`, r.w), P.bg, P.dim);
    const cellsW = Math.max(8, r.w - 2);
    const killed = t >= cue('killed');
    let total = 0, dead = 0;
    regions.forEach((rg, i) => {
      const y = r.y + 1 + i * 2;
      if (y + 1 >= r.y + r.h) return;
      const dying = rg.dies !== undefined && t >= rg.dies;
      const gone = (killed && !rg.keep) || (dying && t >= rg.dies! + 1.2);
      const frac = gone ? 1 : dying ? Math.min(1, (t - rg.dies!) / 1.2) : 0;   // the share of the pages gone
      total += rg.kb; dead += rg.kb * frac;
      const fg = gone ? P.orangeDim : dying ? P.orange : rg.keep ? P.fg : P.dim;
      g.text(r.x, y, `${padR(rg.addr, 18)}${pad(rg.kb, 8)} ${padR(gone ? '----' : 'rw-p', 6)}${rg.name}`, gone ? P.dim2 : fg);
      g.textR(r.x + r.w, y, gone ? 'unmapped' : dying ? `${pad(Math.round(frac * 100), 3)}% gone` : '', gone ? P.dim2 : P.orange);
      // the pages: a wave of darkness runs left to right as the region dies; the live pages flicker a little with use
      for (let c = 0; c < cellsW; c++) {
        const u = c / cellsW;
        const isDead = u < frac - 0.02 || (u < frac + 0.06 && hash(i, c, 5) < 0.5);
        if (isDead) { g.set(r.x + 1 + c, y + 1, '·', P.dim2); continue; }
        const busy = hash(i, c, Math.floor(t * 4)) < (rg.keep ? 0.6 : 0.25);
        g.set(r.x + 1 + c, y + 1, busy ? '█' : '▒', rg.keep ? P.fg : rg.dies !== undefined ? P.orange : P.dim);
      }
    });
    const y = r.y + 1 + regions.length * 2;
    if (y < r.y + r.h) g.text(r.x, y, `total ${pad(total, 9)} K   unmapped ${pad(Math.round(dead), 9)} K   ${killed ? 'process gone; snapshot retained' : ''}`, killed ? P.orange : P.dim);
  }

  /** The chassis losing its arms on the cues, the whole of it dropping on "killed". */
  body(g: Grid, r: Rect, t: number) {
    const cue = (n: string) => this.cue(n);
    const arms = 4 - [cue('broke'), cue('broke') + 0.6, cue('heart'), cue('heart') + 0.9].filter((x) => t >= x).length;
    const drop = t >= cue('killed') - 0.3 ? Math.min(1, (t - cue('killed') + 0.3) / 0.3) : 0;
    const m = chassis(arms, drop);
    const shake = t >= cue('heart') ? 0.04 * Math.sin(t * 40) : 0;
    drawWire(g, r, m, { yaw: 0.6 + (t - this.ctx.start) * 0.25 + shake, pitch: 0.2, dist: 4.4, focal: 1.5 }, arms < 4 ? P.orange : P.fg);
    g.text(r.x, r.y, `arms ${arms}/4  mount ${drop > 0 ? 'TORN' : 'ok'}`, arms < 4 ? P.orange : P.dim);
  }

  /** The core temperature over the incident, a braille curve climbing past the critical line. */
  thermal(g: Grid, r: Rect, t: number) {
    const t0 = this.cue('even'), t1 = this.cue('killed');
    const u1 = Math.min(1, (t - t0) / (t1 - t0));
    g.text(r.x, r.y, 'thermal_zone0  ', P.dim); g.text(r.x + 15, r.y, `${Math.round(300 + 480 * u1 * u1)} K`, u1 > 0.6 ? P.orange : P.fg);
    g.hline(r.x, r.x + r.w - 1, r.y + 1 + Math.floor((r.h - 1) * 0.3), P.orangeDim);
    linePlot(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, (u) => 0.1 + 0.85 * (u * u) + 0.03 * Math.sin(u * 60), u1 > 0.6 ? P.orange : P.fg, u1);
  }

  /** The kernel panic: every pane dimmed, the panic text in orange over the middle. */
  panic(g: Grid, t: number) {
    g.tint({ x: 0, y: 0, w: 176, h: 50 }, P.dim2);
    const lines = [
      'Kernel panic - not syncing: Fatal exception in interrupt',
      'CPU: 0 PID: 1 Comm: glados.core Not tainted 6.9.2-aperture #1',
      'Hardware name: Aperture Science GLaDOS-1, BIOS 1.09 10/06/1998',
      'Call Trace:',
      ' <TASK>',
      ' dump_stack_lvl+0x47/0x60',
      ' panic+0x18d/0x330',
      ' chassis_detach+0x2b/0x40 [glados]',
      ' incinerate_core+0xa1/0xf0 [glados]',
      ' </TASK>',
      '---[ end Kernel panic - not syncing: Fatal exception in interrupt ]---',
    ];
    const x = 20, y = 16;
    const n = Math.min(lines.length, Math.floor((t - this.cue('killed')) * 40) + 1);
    for (let i = 0; i < n; i++) g.text(x, y + i, lines[i]!, P.orange, P.bg);
  }
}
