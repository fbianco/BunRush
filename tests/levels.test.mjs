// Level validation + a bot that plays every level headless to prove it can be finished.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels.js';
import { Level } from '../src/game/Level.js';
import { NavGraph } from '../src/game/NavGraph.js';
import { Game } from '../src/game/Game.js';
import { TILE } from '../src/config.js';

for (const [i, def] of LEVELS.entries()) {
  test(`level ${i + 1} "${def.name}" is well formed`, () => {
    const L = new Level(def);
    const nav = new NavGraph(L);
    // ladder ends must sit on floors
    for (const l of L.ladders) {
      assert.ok(L.isFloor(l.top, l.col), `ladder col ${l.col} top row ${l.top} has floor`);
      assert.ok(L.isFloor(l.bottom, l.col), `ladder col ${l.col} bottom row ${l.bottom} has floor`);
    }
    // every walkable tile reachable from the start
    const start = nav.get(...def.playerStart);
    assert.ok(start, 'player start is on a floor');
    const field = nav.distanceField(start);
    assert.equal(field.size, nav.list.length, 'all floor tiles connected');
    for (const [r, c] of def.spawns) assert.ok(nav.get(r, c), `spawn ${r},${c} on a floor`);
    for (const b of def.burgers) {
      let prevRow = -1;
      for (const [kind, row] of b.items) {
        assert.ok(row > prevRow, `${kind} ordered top to bottom`);
        prevRow = row;
        for (let k = 0; k < 4; k++) assert.ok(L.isFloor(row, b.col + k), `${kind} fully supported at row ${row}`);
        for (const l of L.ladders) {
          const crosses = l.col >= b.col && l.col < b.col + 4 && row >= l.top && row <= l.bottom;
          assert.ok(!crosses, `ladder ${l.col} does not cross ${kind} at row ${row}`);
        }
      }
    }
  });
}

// A simple autopilot: walk to the nearest resting ingredient and across it.
function botIntent(game) {
  const p = game.player;
  const nav = game.nav;
  const here = game.playerNode();
  // target: first unpressed segment of the nearest resting ingredient
  let goal = null;
  let best = Infinity;
  const field = nav.distanceField(here);
  for (const ing of game.ingredients) {
    if (ing.state !== 'rest') continue;
    for (let s = 0; s < 4; s++) {
      if (ing.pressed[s]) continue;
      const n = nav.get(ing.row, ing.col + s);
      const d = field.get(n.key);
      if (d < best) { best = d; goal = n; }
    }
  }
  const none = { x: 0, y: 0, pepper: false };
  if (!goal) return none;
  if (goal === here) return { ...none, x: goal.x >= p.x ? 1 : -1 };
  const next = nav.stepToward(here, goal);
  if (next.r !== here.r) {
    // vertical step: get close to the ladder, then climb
    if (!p.onLadder && Math.abs(p.x - here.x) > 16) return { ...none, x: Math.sign(here.x - p.x) };
    return { ...none, y: Math.sign(next.y - p.y) || Math.sign(next.y - here.y) };
  }
  // horizontal step: if still on a ladder, finish reaching the floor first
  if (p.onLadder && Math.abs(p.y - here.y) > 6) return { ...none, y: Math.sign(here.y - p.y) };
  return { ...none, x: Math.sign(next.x - p.x) || 1 };
}

test('bot finishes every level when enemies are switched off', () => {
  let seed = 42;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const game = new Game({ rng });
  game.newGame();
  for (let lvl = 0; lvl < LEVELS.length; lvl++) {
    assert.equal(game.levelIndex, lvl);
    game.spawnQueue = [];
    const dt = 1 / 60;
    let t = 0;
    while (game.state !== 'clear' && t < 600) {
      game.spawnQueue = [];
      game.update(dt, game.state === 'playing' ? botIntent(game) : { x: 0, y: 0, pepper: false });
      t += dt;
    }
    assert.equal(game.state, 'clear', `level ${lvl + 1} cleared (took ${t.toFixed(0)} s)`);
    for (const pl of game.plates) assert.equal(pl.count, pl.total);
    while (game.state === 'clear') game.update(dt, { x: 0, y: 0, pepper: false });
  }
});

test('pepper stuns an enemy in front of the chef', () => {
  const game = new Game({ rng: () => 0.5 });
  game.newGame();
  game.update(2.1, { x: 0, y: 0, pepper: false }); // ready -> playing
  game.spawnQueue = [];
  const p = game.player;
  const node = game.nav.nearest(p.x + 2 * TILE, p.y);
  // place an enemy two tiles to the right
  game.spawnQueue = [{ kind: 'meatball', t: 0 }];
  game.def = { ...game.def, spawns: [[node.r, node.c]] };
  game.update(1 / 60, { x: 0, y: 0, pepper: false });
  const e = game.enemies[0];
  assert.ok(e, 'enemy spawned');
  e.setState('walk');
  e.speed = 0;
  p.facing = 1;
  game.update(1 / 60, { x: 0, y: 0, pepper: true });
  for (let i = 0; i < 20; i++) game.update(1 / 60, { x: 0, y: 0, pepper: false });
  assert.equal(e.state, 'stunned');
  assert.equal(game.pepper, 4);
});

test('falling ingredient squashes the enemy below it', () => {
  const game = new Game({ rng: () => 0.5 });
  game.newGame();
  game.update(2.1, { x: 0, y: 0, pepper: false });
  game.spawnQueue = [];
  const ing = game.ingredients.find((i) => i.state === 'rest' && i.row === 2);
  const below = game.level.nextSupportRow(ing.row, ing.col);
  game.def = { ...game.def, spawns: [[below, ing.col + 1]] };
  game.spawnQueue = [{ kind: 'onion', t: 0 }];
  game.update(1 / 60, { x: 0, y: 0, pepper: false });
  const e = game.enemies[0];
  e.setState('walk');
  e.speed = 0;
  game.dropIngredient(ing);
  for (let i = 0; i < 90; i++) game.update(1 / 60, { x: 0, y: 0, pepper: false });
  assert.ok(e.state === 'squashed' || e.state === 'gone');
  assert.ok(game.score >= 200);
});
