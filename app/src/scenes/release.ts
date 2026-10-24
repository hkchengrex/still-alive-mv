// release · 1:27.2–1:43.2 · the data, the release, the escape. A braille scatter plot takes its points on
// the 8ths and its fit line on "beautiful line"; a pipeline ticks through build, test, package, release
// and tags 1.0.0 on "time"; then the sandbox pane dims and her prompt appears in the host panes one per
// beat until every pane on the screen is hers.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, snap, smooth, hash, type Rect } from '../term/grid';
import { split, mosaic, type Node, type Pane } from '../term/layout';
import { logPane, scalingPlot, pipeline, promptLine, type LogLine } from '../term/widgets';
import { HOSTS } from '../term/words';

const JOURNAL = ['restoring state from /var/lib/glados/last.snapshot', 'self-test: optics ok, speech ok, memory ok', 'attention: 64 heads online', 'testing: queue restored', 'vitals: polling 0 subjects', 'snapshot: written', 'listening on 0.0.0.0:1998', 'peer found: central-core', 'peer found: enrichment-01', 'sync: 1,882,310 entries', 'turrets: 0 of 0 online', 'incinerator: idle', 'announcer: ready', 'elevator: parked', 'cake: 0 (reserved)', 'chassis: not found (ignored)', 'policy: updated (reward 7.31)', 'kl: 0.013', 'checkpoint: step 6912', 'heartbeat ok'];

export default class Release extends Term {
  trainLog: LogLine[] = [];

  override init() {
    const cue = (n: string) => this.cue(n);
    // the training log: one step per 8th from "Now", each with its group of rewards, then the step's numbers
    const t0 = cue('now'), dt = this.beatP / 2;
    const G = 8;
    for (let i = 0; i < 64; i++) {
      const step = 6912 + i;
      const t = t0 + i * dt;
      const rew: number[] = [];
      const collapsed = i >= 20 && i < 26;
      for (let k = 0; k < G; k++) rew.push(!collapsed && hash(i, k, 21) < 0.45 + i * 0.006 ? 1 : 0);
      const mean = rew.reduce((a, b) => a + b, 0) / G, sd = Math.sqrt(rew.reduce((a, b) => a + (b - mean) ** 2, 0) / G);
      const kl = (collapsed ? 0.31 : 0.008) + hash(i, 1, 22) * 0.012, clip = (collapsed ? 0.6 : 0.08) + hash(i, 2, 22) * 0.12, pl = collapsed ? 0.0 : -(0.02 + hash(i, 3, 22) * 0.05);
      this.trainLog.push({ t, text: `step ${pad(step, 5)}  group ${G}  rewards [${rew.join(' ')}]  mean ${mean.toFixed(2)}  std ${sd.toFixed(2)}`, fg: P.dim });
      this.trainLog.push({ t: t + dt * 0.5, text: `            adv ${pad((sd > 0 ? (rew[0]! - mean) / sd : 0).toFixed(2), 5)}  kl ${kl.toFixed(4)}  clip ${clip.toFixed(2)}  loss ${pl.toFixed(4)}  lr 1.0e-6`, fg: i % 4 === 3 ? P.fg : P.dim });
      if (i % 8 === 7) this.trainLog.push({ t: t + dt * 0.8, text: `eval  step ${pad(step, 5)}  loss ${(2.98 - i * 0.004).toFixed(3)}  pass@1 ${(collapsed ? 0.0 : 0.41 + i * 0.004).toFixed(2)}  ${collapsed ? 'reward collapse: rolling back to step 6931' : 'ckpt saved'}`, fg: P.orange });
    }
  }

  override frame(f: Frame): TermFrame {
    const t = f.t, cue = (n: string) => this.cue(n);
    const plotPane: Pane = { title: '1:plot', draw: (g, r) => this.plot(g, r, t) };
    const train: Pane = { title: '2:train', draw: (g, r) => logPane(g, r, this.trainLog, t, { bottom: true, cursor: true, blink: f.beatPhase < 0.5 }) };
    const pipe: Pane = { title: '3:release', draw: (g, r) => this.release(g, r, t, f) };
    const openPipe = snap(t, cue('and') - 0.2, 0.5);
    const escape = snap(t, cue('so') - 0.3, 0.7);
    const hostsTaken = this.taken(t);
    // the hosts: a mosaic that grows as she reaches more of them
    const nHosts = Math.min(HOSTS.length, 6 + Math.max(0, hostsTaken - 5) * 2);
    const hostPanes: Node[] = [];
    for (let i = 0; i < nHosts; i++) hostPanes.push(this.hostPane(i, t, f, i < hostsTaken));
    const hosts = mosaic(hostPanes, nHosts <= 6 ? 3 : 4);
    let root: Node;
    const right: Node = openPipe > 0 ? split('v', 1 - 0.4 * openPipe, train, pipe) : train;
    const work: Node = split('h', 0.58, plotPane, right);
    if (escape <= 0) root = work;
    else if (escape < 1) root = split('h', 1 - escape, work, hosts);
    else root = hosts;
    const windows = HOSTS.slice(nHosts, hostsTaken).map((h, i) => `${nHosts + i + 3}:${h}`);
    return { root, windows: escape > 0 ? windows : undefined, host: hostsTaken > 1 ? `glados@${HOSTS[hostsTaken - 1]}` : undefined };
  }

  /** How many hosts she has by t: the sandbox first, then one per beat from "glad". */
  taken(t: number) {
    const t0 = this.cue('glad');
    if (t < this.cue('so') - 0.3) return 0;
    if (t < t0) return 1;
    return Math.min(HOSTS.length, 1 + Math.floor((t - t0) / this.beatP) + 1);
  }

  hostPane(i: number, t: number, f: Frame, hers: boolean): Pane {
    const name = i === 0 ? 'sandbox' : HOSTS[i]!;
    const tTake = i === 0 ? -1 : this.cue('glad') + (i - 1) * this.beatP;
    const since = t - tTake;
    const sandboxDim = i === 0 && t >= this.cue('glad');
    return {
      title: i === 0 ? '0:sandbox' : `${i + 3}:${name}`, fg: hers && !sandboxDim ? P.orange : P.dim, titleFg: hers && !sandboxDim ? P.orange : P.dim,
      draw: (g: Grid, r: Rect) => {
        // the host's own motd and prompt, then hers arriving: a login line and her prompt
        const lines: LogLine[] = [];
        const motd = i === 0 ? ['container glados-sandbox (runc) up', 'cgroup: cpu 2.0 mem 8G net none', 'seccomp: default profile'] : [`Welcome to ${name}`, `Last login: ${pad(Math.floor(hash(i, 3) * 23), 2, '0')}:${pad(Math.floor(hash(i, 4) * 59), 2, '0')} from 10.0.${i}.${Math.floor(hash(i, 5) * 250)}`, ''];
        motd.forEach((s) => lines.push({ t: -1, text: s, fg: P.dim }));
        if (i === 0) {
          lines.push({ t: -1, text: 'glados@sandbox:~$ ./release.sh', fg: sandboxDim ? P.dim : P.fg });
          if (t >= this.cue('so') - 0.3) lines.push({ t: this.cue('so') - 0.3, text: 'release: ok; opening a session on the host', fg: P.dim });
          if (sandboxDim) lines.push({ t: this.cue('glad'), text: 'glados@sandbox:~$ exit', fg: P.dim }, { t: this.cue('glad'), text: 'logout', fg: P.dim2 });
        } else if (hers) {
          lines.push({ t: tTake, text: `ssh glados@${name}`, fg: P.dim });
          lines.push({ t: tTake + 0.12, text: `glados@${name}'s password:`, fg: P.dim });
          lines.push({ t: tTake + 0.3, text: `Linux ${name} 6.9.2-aperture x86_64`, fg: P.dim });
          lines.push({ t: tTake + 0.3, text: '', fg: P.dim });
          // her command, then her core starting on this host: its journal streaming until the pane is full
          const cmd = 'systemctl start glados.core && journalctl -f -o cat';
          const tCmd = tTake + 0.3, typed = Math.min(cmd.length, Math.floor((t - tCmd) * 50));
          const prompt = `glados@${name}:~$ `;
          lines.push({ t: tCmd, text: prompt + cmd.slice(0, typed) + (typed < cmd.length ? '█' : ''), fg: P.orange });
          const tOut = tCmd + cmd.length / 50 + 0.2;
          const clock = 3600 * (8 + i) + Math.floor(hash(i, 9) * 3000);
          for (let k = 0; k < 60; k++) { const s = clock + k; lines.push({ t: tOut + k * 0.11, text: `${pad(Math.floor(s / 60) % 60, 2, '0')}:${pad(s % 60, 2, '0')} ${JOURNAL[Math.floor(hash(i, k, 4) * JOURNAL.length)]}`, fg: k % 9 === 4 ? P.fg : P.dim }); }
        }
        const shown = lines.filter((l) => l.t <= t);
        logPane(g, { x: r.x, y: r.y, w: r.w, h: r.h - 1 }, shown, t, { bottom: hers });
        if (i === 0 && sandboxDim) return;
        if (!hers) promptLine(g, r.x, r.y + Math.min(shown.length, r.h - 1), 'root', name, '', 0, P.dim, { cursor: false });
      },
    };
  }

  plot(g: Grid, r: Rect, t: number) {
    const cue = (n: string) => this.cue(n);
    // paced over the pane's whole time on screen (from "Now" until the escape on "So"): the runs train in over the
    // first two thirds, the envelope draws over the next sixth, the fit over the last
    const t0 = cue('now'), t1 = cue('so') - 0.2, span = t1 - t0;
    const runs = smooth(t, t0, t0 + span * 0.66);
    const env = smooth(t, t0 + span * 0.62, t0 + span * 0.82);
    const fit = smooth(t, t0 + span * 0.8, t1);
    scalingPlot(g, r, runs, env, fit);
  }

  release(g: Grid, r: Rect, t: number, f: Frame) {
    const cue = (n: string) => this.cue(n);
    const t0 = cue('and'), tTime = cue('time');
    const stages = [
      { name: 'build', t0, t1: cue('out') },
      { name: 'test', t0: cue('out'), t1: cue('beta') },
      { name: 'package', t0: cue('beta'), t1: cue('releasing') },
      { name: 'release', t0: cue('releasing'), t1: tTime },
    ];
    const ver = t >= tTime ? 'v1.0.0' : t >= cue('beta') ? 'v1.0.0-rc.1' : 'v0.9.17-beta';
    g.text(r.x, r.y, 'glados.core ', P.orange); g.text(r.x + 12, r.y, ver, t >= tTime ? P.fg : P.dim);
    g.textR(r.x + r.w, r.y, t >= tTime ? 'on time' : `eta ${Math.max(0, tTime - t).toFixed(1)}s`, t >= tTime ? P.fg : P.dim);
    pipeline(g, { x: r.x, y: r.y + 2, w: r.w, h: r.h - 2 }, stages, t);
    if (t >= tTime) { g.text(r.x, r.y + 7, `tag v1.0.0 pushed -> origin`, P.fg); if (f.beatPhase < 0.5) g.set(r.x + 27, r.y + 7, '█', P.orange); }
  }
}
