// ---------------------------------------------------------------------------
// Ingredient: one 4-segment burger layer.
// Walk over all 4 segments -> it falls to the next floor that can hold it,
// or onto its plate when there is none.
// ---------------------------------------------------------------------------
import { INGREDIENT_H, TILE, restY } from '../config.js';

export class Ingredient {
  constructor(kind, col, row, burger) {
    this.kind = kind;
    this.col = col;
    this.row = row;
    this.burger = burger;          // index of the burger / plate it belongs to
    this.x0 = col * TILE;          // left edge, level pixels
    this.h = INGREDIENT_H[kind];
    this.y = restY(row);           // bottom edge
    this.vy = 0;
    this.state = 'rest';           // 'rest' | 'falling' | 'plated'
    this.pressed = [false, false, false, false];
    this.target = null;            // { type: 'floor', row } | { type: 'plate' }
    this.bounce = 0;               // little squash animation after landing
    this.kicked = null;            // ingredient below that we already knocked
  }

  get allPressed() {
    return this.pressed.every(Boolean);
  }

  startFall(level, initialSpeed = 60) {
    const below = level.nextSupportRow(this.row, this.col);
    this.target = below !== null ? { type: 'floor', row: below } : { type: 'plate' };
    this.state = 'falling';
    this.vy = initialSpeed;
    this.kicked = null;
  }
}
