// Unit tests for the gesture interpreter, using synthetic skeletons.
// Run with:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestureInterpreter } from '../src/input/GestureInterpreter.js';

// Build 33 fake landmarks for a person standing facing the camera.
// cx = shoulder centre x, shY = shoulder y (0..1 of the image), sw = shoulder width.
// The camera image is not mirrored: the person's LEFT side is at +x.
// left / right = where each wrist is: 'down' | 'up' | 'out' (stretched sideways)
//   | 'across' (crossed over to the other side, at chest height)
function pose({ cx = 0.5, shY = 0.4, sw = 0.2, handsUp = false, left = 'down', right = 'down' } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: cx, y: shY, visibility: 0.99 }));
  lm[0] = { x: cx, y: shY - 0.15, visibility: 0.99 };                 // nose
  lm[11] = { x: cx + sw / 2, y: shY, visibility: 0.99 };              // left shoulder (image right)
  lm[12] = { x: cx - sw / 2, y: shY, visibility: 0.99 };
  const wrist = (s, where) => {
    if (handsUp || where === 'up') return { x: cx + s * sw * 0.7, y: shY - 0.3 };
    if (where === 'out') return { x: cx + s * sw * 2.1, y: shY + 0.02 };
    if (where === 'across') return { x: cx - s * sw * 0.6, y: shY + 0.08 };
    return { x: cx + s * sw * 0.7, y: shY + 0.3 };
  };
  lm[15] = { ...wrist(1, left), visibility: 0.95 };
  lm[16] = { ...wrist(-1, right), visibility: 0.95 };
  lm[23] = { x: cx + sw * 0.35, y: shY + 0.3, visibility: 0.9 };
  lm[24] = { x: cx - sw * 0.35, y: shY + 0.3, visibility: 0.9 };
  return lm;
}

// Feed `frames` frames of the same pose at 30 fps, return the last output.
function hold(g, p, t0, frames = 15) {
  let out;
  for (let i = 0; i < frames; i++) out = g.update(p, t0 + i * 33);
  return { out, t: t0 + frames * 33 };
}

function calibrated() {
  const g = new GestureInterpreter();
  g.startCalibration();
  const { t } = hold(g, pose(), 0, 60); // 2 s standing still
  assert.ok(g.baseline, 'baseline captured');
  return { g, t };
}

test('calibration captures the neutral pose', () => {
  const { g } = calibrated();
  assert.ok(Math.abs(g.baseline.x - 0.5) < 1e-6);
  assert.ok(Math.abs(g.baseline.sw - 0.2) < 1e-6);
});

test('standing still = no intent', () => {
  const { g, t } = calibrated();
  const { out } = hold(g, pose(), t);
  assert.equal(out.x, 0);
  assert.equal(out.y, 0);
  assert.equal(out.pepper, false);
});

test('right arm stretched sideways walks right', () => {
  const { g, t } = calibrated();
  const { out } = hold(g, pose({ right: 'out' }), t);
  assert.equal(out.x, 1);
});

test('left arm stretched sideways walks left', () => {
  const { g, t } = calibrated();
  const { out } = hold(g, pose({ left: 'out' }), t);
  assert.equal(out.x, -1);
});

test('arms work wherever you stand in the picture', () => {
  const { g, t } = calibrated();
  const { out } = hold(g, pose({ cx: 0.3, left: 'out' }), t);
  assert.equal(out.x, -1);
});

test('leaning or stepping sideways alone does nothing', () => {
  const { g, t } = calibrated();
  const { out } = hold(g, pose({ cx: 0.3 }), t);
  assert.equal(out.x, 0);
});

test('both arms out (T pose) does nothing', () => {
  const { g, t } = calibrated();
  const { out } = hold(g, pose({ left: 'out', right: 'out' }), t);
  assert.equal(out.x, 0);
});

test('an arm only swinging through for one frame does not walk', () => {
  const { g, t } = calibrated();
  let r = hold(g, pose(), t, 3);
  const out = g.update(pose({ right: 'out' }), r.t);
  assert.equal(out.x, 0);
});

test('hysteresis: a stretched arm that sags a little keeps walking', () => {
  const { g, t } = calibrated();
  let r = hold(g, pose({ right: 'out' }), t);
  assert.equal(r.out.x, 1);
  const sag = pose({ right: 'out' });
  sag[16].x = 0.5 - 0.2 * 1.35; // 0.85 widths out from the shoulder: between exit and enter
  r = hold(g, sag, r.t);
  assert.equal(r.out.x, 1);
  r = hold(g, pose(), r.t);
  assert.equal(r.out.x, 0);
});

test('both arms on your left throws pepper to the left, once', () => {
  const { g, t } = calibrated();
  let peppers = 0;
  let dir = 0;
  let tt = t;
  for (let i = 0; i < 30; i++) {
    const out = g.update(pose({ left: 'out', right: 'across' }), tt);
    if (out.pepper) { peppers++; dir = out.pepperDir; }
    assert.equal(out.x, 0, 'no walking while peppering');
    tt += 33;
  }
  assert.equal(peppers, 1);
  assert.equal(dir, -1);
});

test('both arms on your right throws pepper to the right', () => {
  const { g, t } = calibrated();
  let dir = 0;
  let tt = t;
  for (let i = 0; i < 10; i++) {
    const out = g.update(pose({ right: 'out', left: 'across' }), tt);
    if (out.pepper) dir = out.pepperDir;
    tt += 33;
  }
  assert.equal(dir, 1);
});

test('the pointing arm left out after pepper does not walk', () => {
  const { g, t } = calibrated();
  let r = hold(g, pose({ left: 'out', right: 'across' }), t);
  r = hold(g, pose({ left: 'out' }), r.t);   // crossing arm back down first
  assert.equal(r.out.x, 0);
  r = hold(g, pose(), r.t);                  // lower it...
  r = hold(g, pose({ left: 'out' }), r.t);   // ...and stretch it again: walk
  assert.equal(r.out.x, -1);
});

test('pepper needs a pause before the next one', () => {
  const { g, t } = calibrated();
  let peppers = 0;
  let tt = t;
  const seq = [...Array(4).fill('p'), ...Array(3).fill('n'), ...Array(4).fill('p')];
  for (const k of seq) {
    if (g.update(k === 'p' ? pose({ left: 'out', right: 'across' }) : pose(), tt).pepper) peppers++;
    tt += 33;
  }
  assert.equal(peppers, 1);
});

test('both hands up = climb', () => {
  const { g, t } = calibrated();
  const { out } = hold(g, pose({ handsUp: true }), t);
  assert.equal(out.y, -1);
  assert.equal(out.handsUp, true);
});

test('squat = go down', () => {
  const { g, t } = calibrated();
  const { out } = hold(g, pose({ shY: 0.55 }), t);
  assert.equal(out.y, 1);
});

test('nobody in view = present false and no movement', () => {
  const { g, t } = calibrated();
  const out = g.update(null, t);
  assert.equal(out.present, false);
  assert.equal(out.x, 0);
});

test('hands up works before calibration (used to start the game)', () => {
  const g = new GestureInterpreter();
  const { out } = hold(g, pose({ handsUp: true }), 0, 40);
  assert.equal(out.handsUp, true);
  assert.ok(out.handsUpHeld > 1);
});

test('calibration waits until the hands are down', () => {
  const g = new GestureInterpreter();
  g.startCalibration();
  let r = hold(g, pose({ handsUp: true }), 0, 60);
  assert.equal(g.baseline, null, 'no baseline while hands are up');
  r = hold(g, pose(), r.t, 60);
  assert.ok(g.baseline);
});

test('baseline slowly re-centres after a small posture change', () => {
  const { g, t } = calibrated();
  const r = hold(g, pose({ shY: 0.43 }), t, 300); // stand a bit lower for 10 s
  assert.equal(r.out.y, 0);
  assert.ok(Math.abs(r.out.lift) < 0.05, `lift ${r.out.lift} back near 0`);
});

test('raising both hands never throws pepper', () => {
  const { g, t } = calibrated();
  let peppers = 0;
  let tt = t;
  for (const k of ['down', 'out', 'up', 'up', 'up']) {
    for (let i = 0; i < 3; i++) {
      if (g.update(pose({ left: k, right: k }), tt).pepper) peppers++;
      tt += 33;
    }
  }
  assert.equal(peppers, 0);
});
