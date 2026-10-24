// A small wireframe engine for the braille panes: points and edges in 3D, turned and projected,
// drawn as dotted lines on the grid. Models are built from a few primitives (lathes, rings, polylines).
import { Grid, CW, CH, type Rect, type Color } from './grid';

export type V3 = [number, number, number];
export interface Model { pts: V3[]; edges: [number, number][] }

export const model = (): Model => ({ pts: [], edges: [] });
export function addPolyline(m: Model, pts: V3[], closed = false) {
  const base = m.pts.length;
  m.pts.push(...pts);
  for (let i = 0; i + 1 < pts.length; i++) m.edges.push([base + i, base + i + 1]);
  if (closed && pts.length > 2) m.edges.push([base + pts.length - 1, base]);
}
/** A ring of radius r in the plane normal to `axis` at offset `at` along it. */
export function addRing(m: Model, r: number, at: number, n = 16, axis: 'x' | 'y' | 'z' = 'z', c: V3 = [0, 0, 0]) {
  const pts: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, u = r * Math.cos(a), v = r * Math.sin(a);
    pts.push(axis === 'z' ? [c[0] + u, c[1] + v, c[2] + at] : axis === 'y' ? [c[0] + u, c[1] + at, c[2] + v] : [c[0] + at, c[1] + u, c[2] + v]);
  }
  addPolyline(m, pts, true);
}
/** A lathe: a profile of (radius, z) revolved about z: rings at each station and `longs` meridians. */
export function addLathe(m: Model, profile: [number, number][], n = 16, longs = 8, c: V3 = [0, 0, 0]) {
  const base = m.pts.length;
  for (const [r, z] of profile) for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    m.pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2] + z]);
  }
  for (let s = 0; s < profile.length; s++) {
    if (profile[s]![0] > 1e-6) for (let i = 0; i < n; i++) m.edges.push([base + s * n + i, base + s * n + ((i + 1) % n)]);
    if (s + 1 < profile.length) for (let i = 0; i < n; i += n / longs) m.edges.push([base + s * n + i, base + (s + 1) * n + i]);
  }
}
export function addBox(m: Model, a: V3, b: V3) {
  const base = m.pts.length;
  for (let i = 0; i < 8; i++) m.pts.push([i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]);
  const E: [number, number][] = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (const [p, q] of E) m.edges.push([base + p, base + q]);
}
/** Merge `src` into `m`, transformed. */
export function addModel(m: Model, src: Model, fn: (p: V3) => V3 = (p) => p) {
  const base = m.pts.length;
  for (const p of src.pts) m.pts.push(fn(p));
  for (const [a, b] of src.edges) m.edges.push([base + a, base + b]);
}

export const rotX = (p: V3, a: number): V3 => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
export const rotY = (p: V3, a: number): V3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
export const rotZ = (p: V3, a: number): V3 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];
export const add = (p: V3, q: V3): V3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
export const scale = (p: V3, s: number): V3 => [p[0] * s, p[1] * s, p[2] * s];

export interface View {
  /** Yaw about y, pitch about x, roll about z (radians), applied to the model. */
  yaw: number; pitch: number; roll?: number;
  /** Camera distance along +z after the turn; focal length in model units per unit of the pane's half height. */
  dist: number; focal?: number;
  /** Which edges to draw: 0..1 of the list, for a model that draws itself in. */
  reveal?: number;
}

/** Draw a model into a pane's rect (in cells) with braille lines; the model's unit sphere fits the pane height. */
export function drawWire(g: Grid, r: Rect, m: Model, v: View, fg: Color, revealOrder?: number[]) {
  const dw = r.w * 2, dh = r.h * 4;                      // the pane in dots
  const aspect = (CW / 2) / (CH / 4);                    // a dot's width over its height (dots are nearly square)
  const cx = r.x * 2 + dw / 2, cy = r.y * 4 + dh / 2;
  const f = (v.focal ?? 1.6) * dh / 2;
  const proj = (p: V3): [number, number, number] => {
    let q = rotY(p, v.yaw); q = rotX(q, v.pitch); if (v.roll) q = rotZ(q, v.roll);
    const z = q[2] + v.dist;
    return [cx + f * q[0] / z / aspect, cy - f * q[1] / z, z];
  };
  const P = m.pts.map(proj);
  const n = m.edges.length, k = v.reveal === undefined ? n : Math.round(n * Math.min(1, Math.max(0, v.reveal)));
  for (let i = 0; i < k; i++) {
    const ei = revealOrder ? revealOrder[i]! : i;
    const [a, b] = m.edges[ei]!;
    const pa = P[a]!, pb = P[b]!;
    if (pa[2] <= 0.05 || pb[2] <= 0.05) continue;
    g.dline(pa[0], pa[1], pb[0], pb[1], fg);
  }
}

// ---- models

/** The handheld portal device: an egg body, a front ring and barrel, three prongs, a grip. Length along +z (the muzzle at +z). */
export function portalGun(): Model {
  const m = model();
  // the body: a lathe from the back cap to the front opening
  addLathe(m, [[0, -1.0], [0.3, -0.92], [0.46, -0.45], [0.42, 0.05], [0.3, 0.42]], 12, 4);
  // the front ring and the barrel
  addRing(m, 0.34, 0.5, 12); addRing(m, 0.3, 0.62, 12);
  addLathe(m, [[0.14, 0.42], [0.14, 0.95], [0.1, 1.0]], 8, 4);
  // the core in the mouth
  addRing(m, 0.07, 0.55, 8);
  // three prongs from the shoulders, curving in toward the muzzle
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
    const pts: V3[] = [];
    for (let s = 0; s <= 8; s++) {
      const u = s / 8, rr = 0.46 + 0.18 * Math.sin(u * Math.PI) - 0.22 * u, z = 0.1 + u * 1.25;
      pts.push([rr * Math.cos(a), rr * Math.sin(a), z]);
    }
    addPolyline(m, pts);
    addPolyline(m, pts.map((p) => rotZ(p, 0.08)));
  }
  // the grip under the body
  addBox(m, [-0.1, -0.85, -0.55], [0.1, -0.42, -0.15]);
  return m;
}

/** A test chamber: a box room with a door, panels drawn as a grid on one wall, a pit. */
export function chamber(): Model {
  const m = model();
  addBox(m, [-1.4, -0.7, -1.0], [1.4, 0.7, 1.0]);
  // the far wall's panel grid
  for (let i = 1; i < 6; i++) { const x = -1.4 + i * 2.8 / 6; addPolyline(m, [[x, -0.7, 1.0], [x, 0.7, 1.0]]); }
  for (let j = 1; j < 3; j++) { const y = -0.7 + j * 1.4 / 3; addPolyline(m, [[-1.4, y, 1.0], [1.4, y, 1.0]]); }
  // a door on the right wall, a button on the floor, a cube
  addPolyline(m, [[1.4, -0.7, -0.3], [1.4, 0.2, -0.3], [1.4, 0.2, 0.2], [1.4, -0.7, 0.2]]);
  addRing(m, 0.2, -0.69, 12, 'y', [-0.5, 0, -0.3]);
  addBox(m, [0.3, -0.7, 0.3], [0.6, -0.4, 0.6]);
  return m;
}

/** A weighted storage cube: a box with the chamfered corner marks and the heart-less centre plates. */
export function cube(): Model {
  const m = model();
  addBox(m, [-0.6, -0.6, -0.6], [0.6, 0.6, 0.6]);
  for (const s of [-1, 1] as const) {
    addRing(m, 0.3, s * 0.61, 12, 'z'); addRing(m, 0.3, s * 0.61, 12, 'y'); addRing(m, 0.3, s * 0.61, 12, 'x');
  }
  return m;
}

/** An order of edges that draws a model part by part, from the back cap forward (by the mean z of the edge). */
export function revealByZ(m: Model): number[] {
  return m.edges.map((e, i) => ({ i, z: (m.pts[e[0]]![2] + m.pts[e[1]]![2]) / 2 })).sort((a, b) => a.z - b.z).map((e) => e.i);
}

/**
 * GLaDOS's chassis, hanging: a mount ring at the top, a spine of rings widening into the body, the head
 * with its eye ring at the bottom front; `arms` of the four arms present (0..4), `drop` lowers the head
 * and body (the chassis torn from its mount). Vertical is +y; the eye looks toward -z.
 */
export function chassis(arms = 4, drop = 0): Model {
  const m = model();
  addRing(m, 0.5, 1.25, 16, 'y'); addRing(m, 0.42, 1.15, 16, 'y');
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; addPolyline(m, [[Math.cos(a) * 0.5, 1.25, Math.sin(a) * 0.5], [Math.cos(a) * 0.9, 1.6, Math.sin(a) * 0.9]]); }
  const stations: [number, number][] = [[0.18, 0.95], [0.14, 0.7], [0.16, 0.45], [0.26, 0.2], [0.38, -0.05], [0.42, -0.3], [0.36, -0.55], [0.3, -0.72]];
  const d = -drop * 0.6;
  stations.forEach(([r, y], i) => { addRing(m, r, y + d * (i / stations.length), 12, 'y'); });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    const pts: V3[] = stations.map(([r, y], i) => [Math.cos(a) * r, y + d * (i / stations.length), Math.sin(a) * r] as V3);
    addPolyline(m, pts);
  }
  // the head: a short lathe below the body, the eye ring on its front
  const hy = -0.72 + d;
  addRing(m, 0.3, hy - 0.05, 12, 'y'); addRing(m, 0.34, hy - 0.25, 12, 'y'); addRing(m, 0.22, hy - 0.45, 12, 'y');
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; addPolyline(m, [[Math.cos(a) * 0.3, hy - 0.05, Math.sin(a) * 0.3], [Math.cos(a) * 0.34, hy - 0.25, Math.sin(a) * 0.34], [Math.cos(a) * 0.22, hy - 0.45, Math.sin(a) * 0.22]]); }
  addRing(m, 0.14, -0.3, 12, 'z', [0, hy - 0.25, 0]); addRing(m, 0.06, -0.33, 8, 'z', [0, hy - 0.25, 0]);
  // the arms: four jointed limbs from the body, the present ones
  for (let k = 0; k < Math.min(4, Math.max(0, arms)); k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const y0 = 0.05 + d * 0.5;
    addPolyline(m, [[Math.cos(a) * 0.38, y0, Math.sin(a) * 0.38], [Math.cos(a) * 0.9, y0 - 0.3, Math.sin(a) * 0.9], [Math.cos(a) * 1.1, y0 - 0.9, Math.sin(a) * 1.1]]);
    addRing(m, 0.08, 0, 8, 'y', [Math.cos(a) * 0.9, y0 - 0.3, Math.sin(a) * 0.9]);
  }
  return m;
}

/** A sentry turret: an egg body on three legs, the eye ring on its front; vertical is +y, the eye toward -z. */
export function turret(open = 1): Model {
  const m = model();
  const body = model();
  addLathe(body, [[0, -0.55], [0.22, -0.45], [0.3, -0.1], [0.26, 0.3], [0.12, 0.55], [0, 0.6]], 10, 5);
  addModel(m, body, (p) => rotX(p, -Math.PI / 2));             // the lathe's axis was z: stand it up
  addRing(m, 0.08, -0.3, 8, 'z', [0, 0.05, 0]);
  addRing(m, 0.04, -0.31, 6, 'z', [0, 0.05, 0]);
  // the side plates, opened out by `open`
  for (const sgn of [-1, 1] as const) {
    const o = 0.28 + 0.22 * open;
    addPolyline(m, [[sgn * o, 0.35, -0.1], [sgn * (o + 0.1), 0.0, -0.05], [sgn * o, -0.4, 0.0], [sgn * (o - 0.14), -0.1, 0.05]], true);
  }
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + Math.PI / 2; addPolyline(m, [[0, -0.5, 0], [Math.cos(a) * 0.45, -1.0, Math.sin(a) * 0.45]]); }
  return m;
}

/** A wall of panels, nx by ny, each a quad turned about its horizontal axis by `flip(i, j)` radians; the wall faces -z. */
export function panelWall(nx: number, ny: number, flip: (i: number, j: number) => number, gap = 0.08): Model {
  const m = model();
  const w = 2.4 / nx, h = 1.6 / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = -1.2 + (i + 0.5) * w, cy = 0.8 - (j + 0.5) * h, a = flip(i, j);
    const hw = w / 2 - gap / 2, hh = h / 2 - gap / 2;
    const q: V3[] = [[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]].map((p) => { const r = rotX(p as V3, a); return [cx + r[0], cy + r[1], r[2]] as V3; });
    addPolyline(m, q, true);
  }
  return m;
}

/** A heart outline in the plane, radius about `r`, centred at the origin. */
function heart(r: number, n = 24): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([r * Math.pow(Math.sin(a), 3), r * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16]);
  }
  return pts;
}

/** The companion cube: the box with its chamfer marks and a heart on every face. */
export function companionCube(): Model {
  const m = model();
  addBox(m, [-0.6, -0.6, -0.6], [0.6, 0.6, 0.6]);
  const h = heart(0.3);
  for (const s of [-1, 1] as const) {
    addPolyline(m, h.map(([x, y]) => [x, y, s * 0.61] as V3), true);
    addPolyline(m, h.map(([x, y]) => [x, s * 0.61, y] as V3), true);
    addPolyline(m, h.map(([x, y]) => [s * 0.61, x, y] as V3), true);
  }
  // the corner plates
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c: V3 = [sx * 0.6, sy * 0.6, sz * 0.6];
    addPolyline(m, [[c[0] - sx * 0.2, c[1], c[2]], [c[0], c[1] - sy * 0.2, c[2]], [c[0], c[1], c[2] - sz * 0.2]], true);
  }
  return m;
}

/**
 * A ball dropped from rest at height H bouncing on the floor with restitution e under gravity g:
 * its height at time t since the drop (0 once it has come to rest), and whether it is still bouncing.
 */
export function bounce(t: number, H = 1.4, g = 6, e = 0.55): { h: number; done: boolean } {
  if (t < 0) return { h: H, done: false };
  const t1 = Math.sqrt(2 * H / g);
  if (t < t1) return { h: H - 0.5 * g * t * t, done: false };
  let v = g * t1, tt = t - t1;
  for (let k = 0; k < 7; k++) {
    v *= e;
    const T = 2 * v / g;
    if (T < 0.03) break;
    if (tt < T) return { h: Math.max(0, v * tt - 0.5 * g * tt * tt), done: false };
    tt -= T;
  }
  return { h: 0, done: true };
}

/** The exit elevator's shaft: four rails, a floor ring every half unit, from y = -1.2 to the top. */
export function liftShaft(top = 2.6): Model {
  const m = model();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addPolyline(m, [[sx * 0.45, -1.2, sz * 0.45], [sx * 0.45, top, sz * 0.45]]);
  for (let y = -1.2; y <= top; y += 0.5) addRing(m, 0.5, y, 12, 'y');
  // the door frame at the bottom, facing -z
  addPolyline(m, [[-0.3, -1.2, -0.5], [-0.3, -0.3, -0.5], [0.3, -0.3, -0.5], [0.3, -1.2, -0.5]]);
  return m;
}

/** The lift car: a glass cylinder of rings with a floor and a roof, and whoever stands in it as a post. */
export function liftCar(withRider = true): Model {
  const m = model();
  addRing(m, 0.36, -0.45, 12, 'y'); addRing(m, 0.36, 0.45, 12, 'y'); addRing(m, 0.3, 0.5, 12, 'y');
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; addPolyline(m, [[Math.cos(a) * 0.36, -0.45, Math.sin(a) * 0.36], [Math.cos(a) * 0.36, 0.45, Math.sin(a) * 0.36]]); }
  if (withRider) addPolyline(m, [[0, -0.45, 0], [0, 0.1, 0]]);
  return m;
}
