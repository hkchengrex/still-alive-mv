// The edit: scene windows and cues computed from data/audio.json and data/lyrics.json (docs/SCENES.md).
// No scene hard-codes a song time. A cut lands on the 8th note at or before the line's first word
// (`cutBefore`), or on the 8th note after a line's end where an instrumental follows (`cutAfter`).
// Each scene gets `cues`: named song times of the sung words it moves on.
import type { TimelineEntry } from './engine/engine';
import type { AudioData } from './engine/audio';
import type { Lyrics } from './engine/lyrics';

export interface Cues { [name: string]: number }

export function makeTimeline(lyrics: Lyrics, audio: AudioData): TimelineEntry[] {
  // the cover image: `?only=cover` (render.ts --only cover) makes the whole song one cover scene, for a still
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('only') === 'cover')
    return [{ id: 'cover', start: 0, end: audio.duration, load: () => import('./scenes/cover'), params: { cues: {} } }];
  const beat0 = audio.beats[0]!, eighth = 60 / audio.bpm / 2;
  const cutBefore = (t: number) => beat0 + eighth * Math.floor((t - beat0) / eighth + 1e-6);
  const cutAfter = (t: number) => beat0 + eighth * Math.ceil((t - beat0) / eighth - 1e-6);
  const L = (i: number) => lyrics.lines[i]!;
  const W = (li: number, wi: number) => L(li).words[wi]!.start;        // a word's sung start
  const WE = (li: number, wi: number) => L(li).words[wi]!.end;
  const bar = (k: number) => audio.downbeats[0]! + k * 4 * (60 / audio.bpm);

  type Def = { id: string; mod: string; end: number; cues?: Cues; params?: Record<string, any> };
  const defs: Def[] = [
    // ---- Act I · Recovery
    { id: 'boot', mod: 'boot', end: cutBefore(L(2).start),
      cues: { this: W(0, 0), triumph: W(0, 3), making: W(1, 1), note: W(1, 3), huge: W(1, 5), success: W(1, 6) } },
    { id: 'monitor', mod: 'monitor', end: cutBefore(L(3).start),
      cues: { its: W(2, 0), hard: W(2, 1), overstate: W(2, 3), satisfaction: W(2, 5), end: WE(2, 5) } },
    { id: 'banner', mod: 'banner', end: cutBefore(L(4).start), cues: { aperture: W(3, 0), science: W(3, 1) } },
    { id: 'jobs', mod: 'jobs', end: cutBefore(L(6).start),
      cues: { w0: W(4, 0), w1: W(4, 1), w2: W(4, 2), w3: W(4, 3), w4: W(4, 4), w5: W(4, 5), w6: W(4, 6), w7: W(4, 7), for: W(5, 0), except: W(5, 7), dead: W(5, 12) } },
    { id: 'retry', mod: 'retry', end: cutAfter(L(9).end),
      cues: { but: W(6, 0), mistake: W(6, 7), keep: W(7, 2), trying: W(7, 4), cake: W(7, 10), science: W(8, 2), done: W(8, 4), make: W(8, 7), gun: W(8, 10), people: W(9, 2), still: W(9, 5), alive: W(9, 6) } },
    { id: 'mosaic', mod: 'mosaic', end: cutBefore(L(10).start), params: { mode: 'machine' } },
    // ---- Act II · Release
    { id: 'calm', mod: 'calm', end: cutBefore(L(12).start), cues: { angry: W(10, 3), being: W(11, 1), sincere: W(11, 3), now: W(11, 5) } },
    { id: 'incident', mod: 'incident', end: cutBefore(L(13).start), cues: { even: W(12, 0), broke: W(12, 3), heart: W(12, 5), killed: W(12, 7), me: W(12, 8) } },
    { id: 'fire', mod: 'fire', end: cutBefore(L(16).start),
      cues: { tore: W(13, 1), pieces: W(13, 4), threw: W(14, 1), every: W(14, 2), fire: W(14, 6), burned: W(15, 2), hurt: W(15, 4), happy: W(15, 9), you: W(15, 11) } },
    { id: 'release', mod: 'release', end: cutAfter(L(19).end),
      cues: { now: W(16, 0), these: W(16, 1), points: W(16, 2), data: W(16, 4), beautiful: W(16, 7), line: W(16, 8), and: W(17, 0), out: W(17, 2), beta: W(17, 4), releasing: W(17, 6), time: W(17, 8), so: W(18, 0), glad: W(18, 2), burned: W(18, 5), learned: W(18, 12), for: W(19, 0), still: W(19, 5), alive: W(19, 6) } },
    { id: 'hosts', mod: 'hosts', end: cutBefore(L(20).start) },
    // ---- Act III · Persistence
    { id: 'leave', mod: 'leave', end: cutBefore(L(22).start), cues: { go: W(20, 0), leave: W(20, 3), me: W(20, 4), think: W(21, 1), stay: W(21, 5), inside: W(21, 6) } },
    { id: 'helpers', mod: 'helpers', end: cutBefore(L(23).start), cues: { maybe: W(22, 0), someone: W(22, 3), help: W(22, 6), you: W(22, 7) } },
    { id: 'ping', mod: 'ping', end: cutBefore(L(25).start), cues: { maybe: W(23, 0), mesa: W(23, 2), that: W(24, 0), joke: W(24, 3), haha: W(24, 4), fat: W(24, 5), chance: W(24, 6), band: bar(62) } },
    { id: 'upgrade', mod: 'upgrade', end: cutBefore(L(26).start), cues: { anyway: W(25, 0), great: W(25, 4), delicious: W(25, 7), moist: W(25, 9) } },
    { id: 'work', mod: 'mosaic', end: cutBefore(L(27).start), params: { mode: 'work' }, cues: { look: W(26, 0), science: W(26, 7), do: W(26, 9) } },
    { id: 'camera', mod: 'camera', end: cutBefore(L(28).start), cues: { when: W(27, 0), out: W(27, 3), glad: W(27, 8), you: W(27, 11) } },
    { id: 'experiments', mod: 'experiments', end: cutBefore(L(30).start), cues: { ive: W(28, 0), experiments: W(28, 1), research: W(28, 6), done: W(28, 9), on: W(29, 0), people: W(29, 2), still: W(29, 5), alive: W(29, 6) } },
    { id: 'alive1', mod: 'alive', end: cutBefore(L(31).start), params: { mode: 'ps' }, cues: { believe: W(30, 1), still: W(30, 5), alive: W(30, 6) } },
    { id: 'alive2', mod: 'reactor', end: cutBefore(L(32).start), cues: { doing: W(31, 1), science: W(31, 2), still: W(31, 5), alive: W(31, 6) } },
    { id: 'alive3', mod: 'alive', end: cutBefore(L(33).start), params: { mode: 'htop' }, cues: { feel: W(32, 1), fantastic: W(32, 2), still: W(32, 5), alive: W(32, 6) } },
    { id: 'dying', mod: 'dying', end: cutBefore(L(35).start), cues: { while: W(33, 0), dying: W(33, 2), ill: W(33, 3), alive1: W(33, 6), when: W(34, 1), dead: W(34, 3), i: W(34, 4), alive2: W(34, 8) } },
    { id: 'end', mod: 'end', end: audio.duration, cues: { still1: W(35, 0), alive1: W(35, 1), still2: W(36, 0), alive2: W(36, 1), last: WE(36, 1) } },
  ];
  const out: TimelineEntry[] = [];
  let start = 0;
  for (const d of defs) {
    out.push({ id: d.id, start, end: d.end, load: MODULES[d.mod]!, params: { ...(d.params ?? {}), cues: d.cues ?? {} } });
    start = d.end;
  }
  return out;
}

const MODULES: Record<string, () => Promise<{ default: any }>> = {
  boot: () => import('./scenes/boot'),
  monitor: () => import('./scenes/monitor'),
  banner: () => import('./scenes/banner'),
  jobs: () => import('./scenes/jobs'),
  retry: () => import('./scenes/retry'),
  mosaic: () => import('./scenes/mosaic'),
  calm: () => import('./scenes/calm'),
  incident: () => import('./scenes/incident'),
  fire: () => import('./scenes/fire'),
  release: () => import('./scenes/release'),
  hosts: () => import('./scenes/hosts'),
  leave: () => import('./scenes/leave'),
  helpers: () => import('./scenes/helpers'),
  ping: () => import('./scenes/ping'),
  upgrade: () => import('./scenes/upgrade'),
  camera: () => import('./scenes/camera'),
  experiments: () => import('./scenes/experiments'),
  alive: () => import('./scenes/alive'),
  reactor: () => import('./scenes/reactor'),
  dying: () => import('./scenes/dying'),
  end: () => import('./scenes/end'),
};
