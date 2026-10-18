// Body-control movement: gestures are commands, the chef walks ladder to ladder.
// Level 1 ("OPENING SHIFT"): the chef starts on row 17, column 13. On that
// floor there are ladders (going up) at columns 0, 7, 14 and 27.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels.js';
import { Level } from '../src/game/Level.js';
import { Player } from '../src/game/Player.js';
import { colCenter, surfaceY, LADDER_PAUSE } from '../src/config.js';

const DT = 1 / 60;
const body = (x = 0, y = 0) => ({ x, y, auto: true, pepper: false, pepperDir: 0 });

function chef() {
  const def = LEVELS[0];
  return new Player(new Level(def), def.playerStart);
}

/** Run `seconds` of game time with the same intent. */
function run(p, intent, seconds) {
  for (let t = 0; t < seconds; t += DT) p.update(DT, intent);
}

test('a short arm gesture walks all the way to the next ladder, then stops', () => {
  const p = chef();
  run(p, body(-1), 0.15);   // stretch the left arm briefly...
  run(p, body(), 5);        // ...and drop it
  assert.equal(p.x, colCenter(7));
  assert.equal(p.y, surfaceY(17));
  assert.equal(p.travel, null);
});

test('the other arm turns the chef around at once', () => {
  const p = chef();
  run(p, body(-1), 0.2);
  run(p, body(), 0.3);
  const x = p.x;
  run(p, body(1), 0.05);
  run(p, body(), 0.05);
  assert.ok(p.x > x - 1, 'already going back');
  run(p, body(), 3);
  assert.equal(p.x, colCenter(14), 'next ladder to the right of where we were');
});

test('an arm still held at a ladder goes on after a short pause', () => {
  const p = chef();
  run(p, body(-1), 1.5);    // 6 tiles at 120 px/s = 1.6 s: not there yet
  run(p, body(-1), 0.3);
  assert.equal(p.x, colCenter(7), 'stopped at the ladder');
  run(p, body(-1), LADDER_PAUSE + 0.2);
  assert.ok(p.x < colCenter(7), 'walking on');
});

test('hands up away from a ladder walks to the closest one and climbs a full floor', () => {
  const p = chef();             // column 13: the ladder at 14 is closest
  run(p, body(0, -1), 0.15);
  run(p, body(), 4);
  assert.equal(p.x, colCenter(14));
  assert.equal(p.y, surfaceY(14), 'up to the next floor and no further');
  assert.ok(p.onLadder);
});

test('hands up while walking takes the next ladder ahead, not one behind', () => {
  const p = chef();
  run(p, body(-1), 0.15);
  run(p, body(), 0.2);          // walking left, the ladder at 14 is now behind
  run(p, body(0, -1), 0.15);
  run(p, body(), 4);
  assert.equal(p.x, colCenter(7));
  assert.ok(p.onLadder);
  assert.ok(p.y < surfaceY(17));
});

test('an arm stretched while climbing steps off at the next floor', () => {
  const p = chef();
  run(p, body(0, -1), 0.15);
  run(p, body(), 0.4);
  assert.ok(p.onLadder);
  run(p, body(-1), 0.15);       // still between floors: remembered
  run(p, body(), 3);
  assert.ok(!p.onLadder);
  assert.equal(p.y, surfaceY(14));
  assert.ok(p.x < colCenter(14), 'walked off to the left');
});

test('pepper right after an arm gesture cancels the walk it started', () => {
  const p = chef();
  run(p, body(1), 0.15);
  p.aimPepper(-1);
  const x = p.x;
  run(p, body(), 1);
  assert.equal(p.x, x);
  assert.equal(p.facing, -1);
});

test('keyboard still moves only while a key is held', () => {
  const p = chef();
  const key = (x) => ({ x, y: 0, auto: false });
  run(p, key(-1), 0.25);
  const x = p.x;
  run(p, key(0), 1);
  assert.equal(p.x, x);
});
