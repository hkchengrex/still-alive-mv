// helpers · 1:58.0–2:05.0 · someone else to help you. A long listing of the facility's helpers scrolls
// past, every one of them deprecated, empty or missing; on "help" the search comes back with nothing.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, padR, hash, type Rect } from '../term/grid';
import { split, type Node, type Pane } from '../term/layout';
import { logPane, type LogLine } from '../term/widgets';
import { drawWire, companionCube, type Model } from '../term/wire';

const NAMES = ['anger.core', 'curiosity.core', 'intelligence.core', 'morality.core', 'space.core', 'fact.core', 'adventure.core', 'companion.cube', 'turret.standard', 'turret.rocket', 'announcer', 'wheatley', 'cave.recording', 'caroline', 'atlas', 'p-body', 'party.escort', 'orange', 'blue', 'doug', 'borealis.crew', 'ratman', 'crusher', 'emancipation.grill', 'faith.plate', 'excursion.funnel', 'thermal.discouragement', 'aerial.faith', 'propulsion.gel', 'repulsion.gel', 'conversion.gel', 'cake.dispenser', 'relaxation.vault', 'elevator.19', 'radio.1', 'radio.2', 'camera.07', 'camera.13', 'lemons', 'combustible.lemons'];
const STATES = ['deprecated', 'incinerated', 'empty', 'not found', 'in space', 'offline', 'reassigned', 'corrupt', 'moon', 'never installed'];

export default class Helpers extends Term {
  list: LogLine[] = [];
  cube: Model = companionCube();
  override init() {
    const t0 = this.cue('maybe') - 0.2;
    this.list.push({ t: t0, text: 'glados@aperture:~$ ls -la /opt/helpers/', fg: P.dim });
    this.list.push({ t: t0 + 0.05, text: 'total 0', fg: P.dim });
    for (let i = 0; i < 160; i++) {
      const name = NAMES[i % NAMES.length]! + (i >= NAMES.length ? `.${Math.floor(i / NAMES.length)}` : '');
      const st = STATES[Math.floor(hash(i, 2) * STATES.length)]!;
      const size = st === 'empty' || st === 'not found' ? 0 : Math.floor(hash(i, 3) * 90000);
      this.list.push({ t: t0 + 0.1 + i * 0.038, text: `${st === 'not found' ? 'l' : 'd'}r-xr-xr-x  1 glados glados ${pad(size, 7)} Oct ${pad(1 + Math.floor(hash(i, 4) * 19), 2)} 00:${pad(Math.floor(hash(i, 5) * 60), 2, '0')} ${padR(name, 26)} # ${st}`, fg: st === 'not found' || st === 'incinerated' ? P.orange : i % 7 === 3 ? P.fg : P.dim });
    }
  }

  override frame(f: Frame): TermFrame {
    const t = f.t;
    const ls: Pane = { title: '1:ls /opt/helpers', draw: (g, r) => logPane(g, r, this.list, t, { bottom: true }) };
    const find: Pane = { title: '2:find', draw: (g, r) => this.find(g, r, t, f) };
    const lost: Pane = { title: '3:lost+found', fg: P.dim, draw: (g, r) => { drawWire(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 1 }, this.cube, { yaw: (t - this.ctx.start) * 0.6, pitch: 0.4, dist: 3.6, focal: 1.5 }, P.dim); g.text(r.x, r.y, 'companion.cube  (incinerated, by request)', P.dim); } };
    const open = t >= this.cue('someone') - 0.1 ? 1 : 0;
    const right: Node = open ? split('v', 0.6, lost, find) : lost;
    return { root: split('h', 0.6, ls, right) };
  }

  find(g: Grid, r: Rect, t: number, f: Frame) {
    const tS = this.cue('someone'), tH = this.cue('help'), tY = this.cue('you');
    const cmd = 'find / -type f -name "*helper*" -perm /u=x 2>/dev/null | head';
    const typed = Math.min(cmd.length, Math.floor((t - tS) * 60));
    g.text(r.x, r.y, 'glados', P.orange); g.text(r.x + 6, r.y, '@aperture:~$ ', P.dim); g.text(r.x + 19, r.y, cmd.slice(0, typed), P.fg);
    if (typed < cmd.length) { g.set(r.x + 19 + typed, r.y, '█', P.orange); return; }
    const spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
    if (t < tH) { g.text(r.x, r.y + 1, spin[Math.floor(t * 12) % spin.length]! + ' searching ' + pad(Math.floor((t - tS) * 48000), 7) + ' files', P.dim); return; }
    g.text(r.x, r.y + 1, `searched ${pad(Math.floor((tH - tS) * 48000), 7)} files: 0 matches`, P.fg);
    if (t >= tY) { g.text(r.x, r.y + 2, 'glados', P.orange); g.text(r.x + 6, r.y + 2, '@aperture:~$ ', P.dim); if (f.beatPhase < 0.5) g.set(r.x + 19, r.y + 2, '█', P.orange); }
  }
}
