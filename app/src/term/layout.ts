// Panes: a tiling layout tree (tmux's splits) laid out onto the grid, with box borders that are shared
// between neighbours, a title in each top border, and an animated split so panes slide open and shut.
import { Grid, P, rect, inset, type Rect, type Color } from './grid';

export interface Pane {
  /** The title in the top border (`1:pytest`); empty for none. */
  title: string;
  /** Border colour; the title takes the same colour unless `titleFg` is given. */
  fg?: Color;
  titleFg?: Color;
  /** Draw the content into the inner rect (the grid is clipped to it). */
  draw?: (g: Grid, r: Rect) => void;
  /** Background for the inner rect. */
  bg?: Color | null;
}
export interface Split {
  /** 'h': side by side (a left, b right); 'v': a over b. */
  dir: 'h' | 'v';
  /** The fraction of the area given to `a` (0..1), or a fixed size for `b` in cells when `fixed` is set. */
  ratio: number;
  fixed?: boolean;
  a: Node;
  b: Node;
}
export type Node = Pane | Split;
export const isSplit = (n: Node): n is Split => (n as Split).a !== undefined;
export const split = (dir: 'h' | 'v', ratio: number, a: Node, b: Node): Split => ({ dir, ratio, a, b });
/** A split whose second child has a fixed size in cells. */
export const splitFixed = (dir: 'h' | 'v', size: number, a: Node, b: Node): Split => ({ dir, ratio: size, fixed: true, a, b });

export interface Placed { pane: Pane; outer: Rect; inner: Rect }

/** Lay a tree out in a rect (rects include their borders; neighbours share a border line). Panes too small to show are dropped. */
export function layout(node: Node, r: Rect, out: Placed[] = []): Placed[] {
  if (r.w < 3 || r.h < 3) return out;
  if (!isSplit(node)) { out.push({ pane: node, outer: r, inner: inset(r) }); return out; }
  const n = node;
  if (n.dir === 'h') {
    // the shared border column
    let c: number;
    if (n.fixed) c = r.x + r.w - 1 - Math.round(n.ratio) - 1; else c = r.x + Math.round((r.w - 1) * n.ratio);
    c = Math.max(r.x, Math.min(r.x + r.w - 1, c));
    layout(n.a, rect(r.x, r.y, c - r.x + 1, r.h), out);
    layout(n.b, rect(c, r.y, r.x + r.w - c, r.h), out);
  } else {
    let c: number;
    if (n.fixed) c = r.y + r.h - 1 - Math.round(n.ratio) - 1; else c = r.y + Math.round((r.h - 1) * n.ratio);
    c = Math.max(r.y, Math.min(r.y + r.h - 1, c));
    layout(n.a, rect(r.x, r.y, r.w, c - r.y + 1), out);
    layout(n.b, rect(r.x, c, r.w, r.y + r.h - c), out);
  }
  return out;
}

/** Draw placed panes: backgrounds, borders, titles, then the contents clipped to their inner rects. */
export function drawPanes(g: Grid, placed: Placed[], defaultFg: Color = P.dim) {
  for (const p of placed) if (p.pane.bg !== undefined) g.fillBg(p.inner, p.pane.bg);
  for (const p of placed) g.box(p.outer, p.pane.fg ?? defaultFg);
  for (const p of placed) {
    const t = p.pane.title;
    if (t && p.outer.w >= t.length + 6) {
      const fg = p.pane.titleFg ?? p.pane.fg ?? defaultFg;
      g.set(p.outer.x + 1, p.outer.y, '┤', p.pane.fg ?? defaultFg);
      g.text(p.outer.x + 2, p.outer.y, ' ' + t + ' ', fg, null);
      g.set(p.outer.x + 2 + t.length + 2, p.outer.y, '├', p.pane.fg ?? defaultFg);
    }
  }
  for (const p of placed) if (p.pane.draw && p.inner.w > 0 && p.inner.h > 0) g.withClip(p.inner, () => p.pane.draw!(g, p.inner));
}

/** Split a list of panes into a balanced grid (i3's default tiling): rows of roughly equal count. */
export function mosaic(panes: Node[], cols?: number): Node {
  if (panes.length === 1) return panes[0]!;
  const nc = cols ?? Math.ceil(Math.sqrt(panes.length));
  const rows: Node[][] = [];
  for (let i = 0; i < panes.length; i += nc) rows.push(panes.slice(i, i + nc));
  const rowNodes = rows.map((r) => strip('h', r));
  return strip('v', rowNodes);
}
/** Equal splits along one direction. */
export function strip(dir: 'h' | 'v', nodes: Node[]): Node {
  if (nodes.length === 1) return nodes[0]!;
  const [first, ...rest] = nodes;
  return split(dir, 1 / nodes.length, first!, strip(dir, rest));
}
/** Equal splits along one direction with the last `k` of them growing in (0..1 each). */
export function stripGrow(dir: 'h' | 'v', nodes: Node[], grow: number[]): Node {
  // grow[i] is the fraction (0..1) of its full size that node i has reached
  const sizes = nodes.map((_, i) => grow[i] ?? 1);
  const total = sizes.reduce((a, b) => a + b, 0);
  const build = (i: number, remaining: number): Node => {
    if (i === nodes.length - 1) return nodes[i]!;
    const r = remaining > 0 ? sizes[i]! / remaining : 1;
    return split(dir, r, nodes[i]!, build(i + 1, remaining - sizes[i]!));
  };
  return build(0, total);
}
