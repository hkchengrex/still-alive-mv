// camera · 2:23.5–2:27.6 · when I look out there. A camera pane: a wireframe test chamber seen from the
// observation window, turning, a subject as one dot in it; the vitals of the dot in a side pane.
import type { Frame } from '../engine/scene';
import { Term, type TermFrame } from '../term/_term';
import { Grid, P, pad, smooth, held, type Rect } from '../term/grid';
import { split, type Pane } from '../term/layout';
import { sparkline, bar } from '../term/widgets';
import { drawWire, chamber, type Model } from '../term/wire';

export default class Camera extends Term {
  room: Model = chamber();

  override frame(f: Frame): TermFrame {
    const t = f.t;
    const cam: Pane = { title: '1:camera-07', fg: P.dim, titleFg: P.orange, draw: (g, r) => this.view(g, r, t, f) };
    const vitals: Pane = { title: '2:vitals', draw: (g, r) => this.vitals(g, r, t, f) };
    return { root: split('h', 0.68, cam, vitals) };
  }

  view(g: Grid, r: Rect, t: number, f: Frame) {
    const t0 = this.ctx.start, tOut = this.cue('out'), tGlad = this.cue('glad');
    const yaw = 0.5 + (t - t0) * 0.18 + 0.4 * smooth(t, tOut, tOut + 1.2);
    const pitch = 0.42 - 0.1 * smooth(t, tGlad, tGlad + 0.8);
    drawWire(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 2 }, this.room, { yaw, pitch, dist: 3.4, focal: 2.2 }, P.fg);
    // the subject: one dot walking the floor
    const u = (t - t0) * 0.35, sx = -0.9 + (u % 1.8), sz = -0.2 + 0.5 * Math.sin(u * 2.1);
    const p = [sx, -0.62, sz] as [number, number, number];
    const m: Model = { pts: [p, [p[0], p[1] + 0.25, p[2]]], edges: [[0, 1]] };
    drawWire(g, { x: r.x, y: r.y + 1, w: r.w, h: r.h - 2 }, m, { yaw, pitch, dist: 3.4, focal: 2.2 }, P.blue);
    g.text(r.x, r.y, `CAM 07  chamber 19  ${pad(Math.floor(t), 4)}s  REC`, P.dim);
    if (Math.floor(t * 2) % 2 === 0) g.set(r.x + 27, r.y, '●', P.orange);
    g.textR(r.x + r.w, r.y + r.h - 1, `yaw ${(yaw % 6.28).toFixed(2)}  pitch ${pitch.toFixed(2)}`, P.dim);
  }

  vitals(g: Grid, r: Rect, t: number, f: Frame) {
    g.text(r.x, r.y, 'subject-0001', P.blue);
    const th = held(t, 1), hr = 88 + 20 * Math.sin(th * 0.7) + 6 * this.ctx.audio.env('rms', th);
    void f;
    g.text(r.x, r.y + 2, `pulse   ${pad(hr.toFixed(0), 4)} bpm`, P.fg);
    sparkline(g, { x: r.x, y: r.y + 3, w: r.w, h: 3 }, (tt) => 0.3 + 0.7 * Math.max(0, Math.sin(tt * 9.5) ** 9), t, 0.04, P.blue);
    g.text(r.x, r.y + 7, `stress  `, P.fg); bar(g, r.x + 8, r.y + 7, r.w - 10, 0.6 + 0.3 * Math.sin(t * 0.5), P.blue, ' ', P.dim2);
    g.text(r.x, r.y + 8, `o2      `, P.fg); bar(g, r.x + 8, r.y + 8, r.w - 10, 0.96, P.blue, ' ', P.dim2);
    g.text(r.x, r.y + 9, `temp    `, P.fg); bar(g, r.x + 8, r.y + 9, r.w - 10, 0.55, P.blue, ' ', P.dim2);
    g.text(r.x, r.y + 11, 'observer', P.orange);
    g.text(r.x, r.y + 12, `pulse      n/a`, P.dim);
    g.text(r.x, r.y + 13, `stress  `, P.dim); bar(g, r.x + 8, r.y + 13, r.w - 10, 0, P.orange, ' ', P.dim2);
    g.text(r.x, r.y + 14, `status  nominal`, P.fg);
    if (f.beatPhase < 0.5) g.set(r.x, r.y + 16, '█', P.orange);
  }
}
