// ---------------------------------------------------------------------------
// Level: turns the declarative level description into a queryable grid.
// Pure logic, no drawing - so it can be unit tested in Node.
// ---------------------------------------------------------------------------
import { COLS, ROWS, TILE, surfaceY, colCenter } from '../config.js';

export class Level {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.floor = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    for (const f of def.floors) {
      for (let c = f.from; c <= f.to; c++) this.floor[f.row][c] = true;
    }
    this.floorRows = [...new Set(def.floors.map((f) => f.row))].sort((a, b) => a - b);
    this.ladders = def.ladders.map(([col, top, bottom], id) => ({
      id, col, top, bottom,
      x: colCenter(col),
      topY: surfaceY(top),
      bottomY: surfaceY(bottom),
    }));
  }

  isFloor(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS && this.floor[r][c];
  }

  colAt(x) {
    return Math.floor(x / TILE);
  }

  /** Floor row whose surface is within `tol` px of y, or null. */
  floorRowNear(y, tol = 1) {
    for (const r of this.floorRows) if (Math.abs(surfaceY(r) - y) <= tol) return r;
    return null;
  }

  /** Floor rows where a ladder lets you step off (the ladder's "stops"). */
  ladderStops(l) {
    return this.floorRows.filter((r) => r >= l.top && r <= l.bottom && this.isFloor(r, l.col));
  }

  /**
   * A ladder you can climb from (x, y) in direction dir (-1 up, +1 down),
   * if one is within `tol` px horizontally. Returns the closest or null.
   */
  ladderAt(x, y, dir, tol) {
    let best = null;
    let bestD = Infinity;
    for (const l of this.ladders) {
      const d = Math.abs(x - l.x);
      if (d > tol || y < l.topY - 0.5 || y > l.bottomY + 0.5) continue;
      if (dir < 0 && y <= l.topY + 0.5) continue;
      if (dir > 0 && y >= l.bottomY - 0.5) continue;
      if (d < bestD) { best = l; bestD = d; }
    }
    return best;
  }

  /** Next floor row below `row` that can hold a 4-tile ingredient at `col`. */
  nextSupportRow(row, col) {
    for (const r of this.floorRows) {
      if (r <= row) continue;
      let ok = true;
      for (let k = 0; k < 4; k++) if (!this.isFloor(r, col + k)) { ok = false; break; }
      if (ok) return r;
    }
    return null;
  }

  /** Contiguous floor runs, for drawing girders. */
  floorRuns() {
    const runs = [];
    for (const r of this.floorRows) {
      let start = null;
      for (let c = 0; c <= COLS; c++) {
        const f = this.isFloor(r, c);
        if (f && start === null) start = c;
        if (!f && start !== null) { runs.push({ row: r, from: start, to: c - 1 }); start = null; }
      }
    }
    return runs;
  }
}
