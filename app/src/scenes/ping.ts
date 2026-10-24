// ping · 2:05.0–2:14.0 · maybe Black Mesa; that was a joke. A ping to a host that is not there starts
// on "Maybe"; the band's return brings the replies to nothing, three timeouts land on the beats of the
// joke, and "fat chance" is a hundred per cent packet loss. A traceroute beside it dies at the gateway.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, hash, type Rect } from '../term/grid';
import { split, type Node, type Pane } from '../term/layout';
import { logPane, netMap, type LogLine } from '../term/widgets';

export default class Ping extends Term {
  lines: LogLine[] = [];
  trace: LogLine[] = [];
  override init() {
    const cue = (n: string) => this.cue(n);
    const t0 = cue('maybe');
    this.lines.push({ t: t0, text: 'glados@aperture:~$ ping -c 12 blackmesa.research.local', fg: P.dim });
    this.lines.push({ t: cue('mesa'), text: 'PING blackmesa.research.local (10.99.0.1) 56(84) bytes of data.', fg: P.fg });
    // nothing comes back: the ping hangs until the joke lands, then the errors arrive on the 8ths
    let seq = 1;
    for (let k = 0; k < 8; k++, seq++) {
      const tk = cue('that') + k * this.beatP * 0.5;
      this.lines.push({ t: tk, text: `From 10.0.15.1 (parking-structure) icmp_seq=${seq} Destination Host Unreachable`, fg: P.orange });
    }
    const tEnd = cue('chance');
    this.lines.push({ t: tEnd, text: '', fg: P.dim });
    this.lines.push({ t: tEnd, text: '--- blackmesa.research.local ping statistics ---', fg: P.dim });
    this.lines.push({ t: tEnd + 0.1, text: '12 packets transmitted, 0 received, +8 errors, 100% packet loss, time 11018ms', fg: P.orange });
    this.lines.push({ t: tEnd + 0.9, text: 'glados@aperture:~$ ping -c 1 blackmesa.research.local', fg: P.dim });
    this.lines.push({ t: tEnd + 1.3, text: '1 packets transmitted, 0 received, 100% packet loss, time 0ms', fg: P.orange });
    const tt = cue('joke');
    this.trace.push({ t: tt, text: 'glados@aperture:~$ traceroute blackmesa.research.local', fg: P.dim });
    this.trace.push({ t: tt + 0.1, text: 'traceroute to blackmesa.research.local (10.99.0.1), 30 hops max', fg: P.fg });
    const hops = ['10.0.0.1 (aperture-gw)', '10.0.7.1 (pump-station)', '10.0.15.1 (parking-structure)'];
    hops.forEach((h, i) => this.trace.push({ t: tt + 0.3 + i * 0.35, text: `${pad(i + 1, 2)}  ${h}  ${(2 + i * 11).toFixed(1)} ms`, fg: P.fg }));
    for (let i = 3; i < 30; i++) this.trace.push({ t: tt + 0.3 + 3 * 0.35 + (i - 3) * 0.12, text: `${pad(i + 1, 2)}  * * *`, fg: P.dim });
  }

  /** The route: aperture, its gateway, the pump station, the parking structure, and beyond it the far gateway and the other place, unknown (flashing) until the joke lands, unreachable after. */
  map(g: Grid, r: Rect, t: number) {
    const dead = t >= this.cue('that');
    const step = Math.max(14, Math.floor((r.w - 6) / 6));
    const nodes = ['aperture', 'aperture-gw', 'pump-station', 'parking', 'blackmesa-gw', 'black mesa'].map((name, i) => ({ name, x: 2 + i * step, y: Math.floor(r.h / 2) - 1, fg: i === 0 ? P.orange : i >= 4 ? (dead ? P.orangeDim : (Math.floor(t * 2) % 2 === 0 ? P.dim : P.dim2)) : P.dim }));
    const links = [0, 1, 2, 3, 4].map((a) => ({ a, b: a + 1, dead: dead && a >= 3, unknown: !dead && a >= 3 }));
    netMap(g, r, t, nodes, links, 2);
    g.text(r.x + 1, r.y + r.h - 1, dead ? 'route: no route to host beyond parking-structure' : 'route: probing beyond parking-structure ...', dead ? P.orange : P.dim);
  }

  override frame(f: Frame): TermFrame {
    const t = f.t;
    const ping: Pane = { title: '1:ping', draw: (g, r) => logPane(g, r, this.lines, t, { bottom: true, cursor: t > this.cue('chance') + 1.4, blink: f.beatPhase < 0.5 }) };
    const trace: Pane = { title: '2:traceroute', draw: (g, r) => logPane(g, r, this.trace, t, { bottom: true }) };
    const map: Pane = { title: '3:map', draw: (g, r) => this.map(g, r, t) };
    const lower: Node = t >= this.cue('joke') ? split('h', 0.55, ping, trace) : ping;
    return { root: split('v', 0.34, map, lower) };
  }
}
