// ---------------------------------------------------------------------------
// NavGraph: the level as a graph for enemy AI.
//   node  = one floor tile (row, col)
//   edge  = walk to the neighbouring tile, or ride a ladder to the next stop
// Every few frames we compute a "distance field" from the player's node with
// Dijkstra; each enemy then simply steps to the neighbour with the smallest
// distance. One search serves all enemies.
// ---------------------------------------------------------------------------
import { COLS, colCenter, surfaceY } from '../config.js';

export class NavGraph {
  constructor(level) {
    this.level = level;
    this.nodes = new Map();
    for (const r of level.floorRows) {
      for (let c = 0; c < COLS; c++) {
        if (level.isFloor(r, c)) {
          const key = NavGraph.key(r, c);
          this.nodes.set(key, { key, r, c, x: colCenter(c), y: surfaceY(r), edges: [] });
        }
      }
    }
    const link = (a, b, cost) => {
      a.edges.push({ to: b, cost });
      b.edges.push({ to: a, cost });
    };
    // walking edges
    for (const n of this.nodes.values()) {
      const right = this.get(n.r, n.c + 1);
      if (right) link(n, right, 1);
    }
    // ladder edges between consecutive stops
    for (const l of level.ladders) {
      const stops = level.ladderStops(l);
      for (let i = 0; i + 1 < stops.length; i++) {
        link(this.get(stops[i], l.col), this.get(stops[i + 1], l.col), stops[i + 1] - stops[i]);
      }
    }
    this.list = [...this.nodes.values()];
  }

  static key(r, c) {
    return r * 100 + c;
  }

  get(r, c) {
    return this.nodes.get(NavGraph.key(r, c));
  }

  /** Closest node to a pixel position (ladders count vertical distance more). */
  nearest(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const n of this.list) {
      const d = Math.abs(n.x - x) + Math.abs(n.y - y) * 1.5;
      if (d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  /** Dijkstra from `source`: Map(nodeKey -> distance). */
  distanceField(source) {
    const dist = new Map([[source.key, 0]]);
    const open = [source];
    while (open.length) {
      // tiny graph (~170 nodes): a linear scan beats a heap here
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i].key) < dist.get(open[bi].key)) bi = i;
      const n = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      const d = dist.get(n.key);
      for (const e of n.edges) {
        const nd = d + e.cost;
        if (nd < (dist.get(e.to.key) ?? Infinity)) {
          if (!dist.has(e.to.key)) open.push(e.to);
          dist.set(e.to.key, nd);
        }
      }
    }
    return dist;
  }

  /** Next node on a shortest path from `from` to `to` (used by the test bot). */
  stepToward(from, to) {
    if (from === to) return null;
    const field = this.distanceField(to);
    let best = null;
    let bestD = Infinity;
    for (const e of from.edges) {
      const d = (field.get(e.to.key) ?? Infinity) + e.cost;
      if (d < bestD) { best = e.to; bestD = d; }
    }
    return best;
  }
}
