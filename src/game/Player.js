// ---------------------------------------------------------------------------
// Player (the chef). Position (x, y) = feet, in level pixels.
// Two movement modes:
//   - on a floor : walk left / right, grab a ladder when climbing is asked
//   - on a ladder: move up / down, step off sideways when level with a floor
//
// The input is an "intent" {x, y, auto}. Two ways to read it:
//   manual (keyboard)   : move while x / y is held, stop when released
//   auto (body control) : a new x / y is a COMMAND and the chef carries it out
//     on his own, tile by tile, so camera lag cannot make him miss a ladder:
//       x  -> walk that way until the next ladder (or the end of the floor);
//             the other arm turns him around at once
//       up / down -> climb the ladder here, or walk to the closest one that
//             goes that way and climb it, up to the next floor
//       x while climbing -> remembered, done at the next floor
//     A gesture still held after a stop goes on after LADDER_PAUSE seconds.
// ---------------------------------------------------------------------------
import {
  COLS, PLAYER_SPEED, CLIMB_SPEED, LADDER_GRAB, LADDER_ASSIST, LADDER_PAUSE, PEPPER_CANCELS_WALK,
  surfaceY, colCenter,
} from '../config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Player {
  constructor(level, [row, col]) {
    this.level = level;
    this.start = { row, col };
    this.reset();
  }

  reset() {
    this.x = colCenter(this.start.col);
    this.y = surfaceY(this.start.row);
    this.ladder = null;      // ladder segment we are on, or null
    this.facing = 1;
    this.moving = false;
    this.climbDir = -1;
    this.anim = 0;
    this.pepperAnim = 0;
    // auto mode
    this.clock = 0;
    this.prevX = 0;          // last intent, to spot new commands
    this.prevY = 0;
    this.clearAuto();
  }

  clearAuto() {
    this.travel = null;      // { x, y } direction we are going, or null
    this.travelSince = -Infinity;
    this.goalX = null;       // ladder x we walk to before climbing
    this.climbReq = 0;       // ...and the direction to climb it
    this.queuedX = 0;        // step off this way at the next floor (on ladders)
    this.stoppedAt = -Infinity;
  }

  get onLadder() {
    return this.ladder !== null;
  }

  /** Floor row we stand on (null while between floors on a ladder). */
  get row() {
    return this.level.floorRowNear(this.y, 1);
  }

  update(dt, intent) {
    this.anim += dt;
    this.clock += dt;
    this.pepperAnim = Math.max(0, this.pepperAnim - dt);
    this.moving = false;
    if (intent.auto) {
      this.updateAuto(dt, intent);
    } else {
      this.clearAuto();
      this.updateManual(dt, intent);
    }
    this.prevX = intent.x;
    this.prevY = intent.y;
  }

  /** Pepper thrown towards `dir`: face it, and undo a walk that just began. */
  aimPepper(dir) {
    if (!dir || this.ladder) return;
    if (this.travel?.x && this.clock - this.travelSince < PEPPER_CANCELS_WALK) {
      // the first arm of the pepper pose was probably read as "walk"
      this.travel = null;
      this.goalX = null;
      this.climbReq = 0;
      this.stoppedAt = this.clock;
    }
    this.facing = dir;
  }

  // ---- keyboard: move while held ------------------------------------------
  updateManual(dt, intent) {
    const L = this.level;

    // ---- on a ladder ------------------------------------------------------
    if (this.ladder) {
      if (intent.x !== 0) {
        // step off if we are (nearly) level with a floor at this column
        const r = L.floorRowNear(this.y, 8);
        if (r !== null && L.isFloor(r, this.ladder.col)) {
          this.y = surfaceY(r);
          this.ladder = null;
        }
      }
      if (this.ladder) {
        if (intent.y !== 0) {
          const l = this.ladder;
          this.y = clamp(this.y + intent.y * CLIMB_SPEED * dt, l.topY, l.bottomY);
          this.moving = true;
          this.climbDir = intent.y;
        }
        return;
      }
    }

    // ---- on a floor -------------------------------------------------------
    const row = L.floorRowNear(this.y, 1);
    let ix = intent.x;
    if (intent.y !== 0) {
      const lad = L.ladderAt(this.x, this.y, intent.y, LADDER_GRAB);
      if (lad) {
        this.x = lad.x;
        this.ladder = lad;
        this.y = clamp(this.y + intent.y * CLIMB_SPEED * dt, lad.topY, lad.bottomY);
        this.moving = true;
        this.climbDir = intent.y;
        return;
      }
      // Assist: "up" near a ladder walks you onto it.
      if (ix === 0) {
        const near = L.ladderAt(this.x, this.y, intent.y, LADDER_ASSIST);
        if (near) ix = Math.sign(near.x - this.x);
      }
    }
    if (ix !== 0 && row !== null) {
      this.facing = ix;
      const nx = this.x + ix * PLAYER_SPEED * dt;
      if (L.isFloor(row, L.colAt(nx + ix * 10))) {
        this.x = nx;
        this.moving = true;
      }
    }
  }

  // ---- body control: gestures are commands --------------------------------
  updateAuto(dt, intent) {
    // a command is a NEW gesture, or one still held a moment after a stop
    const held = !this.travel && this.clock - this.stoppedAt >= LADDER_PAUSE;
    if (intent.x !== 0 && (intent.x !== this.prevX || held)) {
      this.commandX(intent.x);
    } else if (intent.y !== 0 && intent.y !== this.prevY) {
      this.commandY(intent.y);
    } else if (intent.y !== 0 && held && this.ladder && this.canClimb(intent.y)) {
      this.commandY(intent.y);   // held: keep climbing, but never go looking for another ladder
    }

    if (!this.travel) return;
    if (this.travel.x) this.walk(dt, this.travel.x);
    else this.climb(dt, this.travel.y);
  }

  startTravel(x, y) {
    if (this.travel?.x !== x || this.travel?.y !== y) this.travelSince = this.clock;
    this.travel = { x, y };
  }

  stop() {
    this.travel = null;
    this.stoppedAt = this.clock;
  }

  commandX(d) {
    const L = this.level;
    if (this.ladder) {
      const r = this.ladderFloorHere();
      if (r === null) {
        this.queuedX = d;        // between floors: do it at the next one
        return;
      }
      if (!L.isFloor(r, this.ladder.col + d)) return;
      this.y = surfaceY(r);
      this.ladder = null;
    }
    this.goalX = null;
    this.climbReq = 0;
    this.queuedX = 0;
    if (this.row === null) return;
    this.startTravel(d, 0);
    this.facing = d;
  }

  commandY(v) {
    const L = this.level;
    this.queuedX = 0;
    if (this.ladder) {
      if (this.canClimb(v)) {
        this.startTravel(0, v);
        return;
      }
      // end of this ladder: get off and look for another one
      const r = this.ladderFloorHere();
      if (r === null) return;
      this.y = surfaceY(r);
      this.ladder = null;
    }
    if (this.grab(v)) return;
    // not at a ladder: walk to the best one on this floor, then climb it
    const target = this.findLadder(v);
    if (!target) return;
    this.goalX = target.x;
    this.climbReq = v;
    const d = Math.sign(target.x - this.x);
    this.startTravel(d, 0);
    this.facing = d;
  }

  /** Get on a ladder going `v` right here, if there is one. */
  grab(v) {
    const lad = this.level.ladderAt(this.x, this.y, v, LADDER_GRAB);
    if (!lad) return false;
    this.x = lad.x;
    this.ladder = lad;
    this.goalX = null;
    this.climbReq = 0;
    this.startTravel(0, v);
    return true;
  }

  canClimb(v) {
    const l = this.ladder;
    return v < 0 ? this.y > l.topY + 0.5 : this.y < l.bottomY - 0.5;
  }

  /** Floor row we are level with while on a ladder, or null. */
  ladderFloorHere() {
    const r = this.level.floorRowNear(this.y, 1);
    return r !== null && this.level.isFloor(r, this.ladder.col) ? r : null;
  }

  /**
   * Ladder on this floor that goes `v`, reachable without leaving the floor:
   * the closest one ahead if we are walking, else the closest one.
   */
  findLadder(v) {
    const L = this.level;
    const row = this.row;
    if (row === null) return null;
    const col = L.colAt(this.x);
    let best = null;
    let bestD = Infinity;
    for (const l of L.ladders) {
      if (this.y < l.topY - 0.5 || this.y > l.bottomY + 0.5) continue;
      if (v < 0 ? this.y <= l.topY + 0.5 : this.y >= l.bottomY - 0.5) continue;
      // the floor must be continuous between here and the ladder
      const s = Math.sign(l.col - col);
      let ok = true;
      for (let c = col; c !== l.col; c += s) if (!L.isFloor(row, c)) { ok = false; break; }
      if (!ok || !L.isFloor(row, l.col)) continue;
      let d = Math.abs(l.x - this.x);
      if (this.travel?.x && Math.sign(l.x - this.x) === -this.travel.x) d += 10000; // behind us
      if (d < bestD) { best = l; bestD = d; }
    }
    return best;
  }

  /** x where a walk in direction d stops: next ladder ahead or end of floor. */
  nextStopX(row, d) {
    const L = this.level;
    let c = L.colAt(this.x);
    for (; c >= 0 && c < COLS; c += d) {
      if (!L.isFloor(row, c)) break;
      const cx = colCenter(c);
      if (d * (cx - this.x) > 0.01 && L.ladders.some((l) => l.col === c && row >= l.top && row <= l.bottom)) {
        return cx;
      }
    }
    return colCenter(c - d); // last floor tile
  }

  walk(dt, d) {
    const row = this.row;
    if (row === null) { this.stop(); return; }
    const stopX = this.goalX ?? this.nextStopX(row, d);
    this.facing = d;
    const nx = this.x + d * PLAYER_SPEED * dt;
    if (d * (nx - stopX) < 0) {
      this.x = nx;
      this.moving = true;
      return;
    }
    // arrived
    this.moving = this.x !== stopX;
    this.x = stopX;
    const v = this.climbReq;
    this.goalX = null;
    this.climbReq = 0;
    if (v && this.grab(v)) return;
    this.stop();
  }

  climb(dt, v) {
    const L = this.level;
    const l = this.ladder;
    // next floor along the ladder in our direction
    let stopY = v < 0 ? l.topY : l.bottomY;
    for (const r of L.ladderStops(l)) {
      const sy = surfaceY(r);
      if (v * (sy - this.y) > 0.01 && v * (sy - stopY) < 0) stopY = sy;
    }
    this.climbDir = v;
    this.moving = true;
    const ny = this.y + v * CLIMB_SPEED * dt;
    if (v * (ny - stopY) < 0) {
      this.y = ny;
      return;
    }
    this.y = stopY;
    this.stop();
    // an arm stretched on the way up / down: step off now
    const q = this.queuedX;
    this.queuedX = 0;
    if (q) this.commandX(q);
  }
}
