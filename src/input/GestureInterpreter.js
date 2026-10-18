// ---------------------------------------------------------------------------
// GestureInterpreter: body landmarks  ->  game intent.
//
// Input : 33 MediaPipe pose landmarks (x, y in 0..1 of the camera image,
//         y pointing down, plus a `visibility` score).
// Output: { x: -1|0|1, y: -1|0|1, pepper: bool, pepperDir: -1|0|1, ... }
//
//   left arm stretched sideways   -> x = -1   (walk left)
//   right arm stretched sideways  -> x = +1   (walk right)
//   both hands above the nose     -> y = -1   (climb)
//   squat                         -> y = +1   (go down)
//   both arms on the same side    -> pepper, thrown towards that side
//
// "Left" and "right" are YOUR left and right; the camera panel is mirrored so
// they match the screen. All distances are measured in shoulder widths, so the
// thresholds do not depend on how far you stand from the camera. Pure logic:
// unit tested in tests/gesture.test.mjs with synthetic skeletons.
// ---------------------------------------------------------------------------
import { GESTURE } from '../config.js';

export const LM = { NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12, L_WRIST: 15, R_WRIST: 16, L_HIP: 23, R_HIP: 24 };
const TRACKED = Object.values(LM);

export class GestureInterpreter {
  constructor(cfg = GESTURE) {
    this.cfg = cfg;
    this.baseline = null;   // { x, y, sw, hy } of the neutral standing pose
    this.calibration = null;
    this.reset();
  }

  reset() {
    this.smooth = null;
    this.prev = null;
    this.crouching = false;
    this.arm = { l: false, r: false };          // stretched (with hysteresis)
    this.armSince = { l: null, r: null };       // ...since when
    this.armBlocked = { l: false, r: false };   // still out after pepper: lower it first
    this.pepperSide = 0;
    this.lastPepperAt = -Infinity;
    this.handsUpSince = null;
    this.out = {
      present: false, calibrated: !!this.baseline,
      x: 0, y: 0, pepper: false, pepperDir: 0,
      handsUp: false, handsUpHeld: 0, crouch: false, lift: 0,
      armL: false, armR: false, pepperPose: 0, body: null,
      points: null,
    };
  }

  startCalibration() {
    this.baseline = null;
    this.calibration = { start: null, samples: [] };
    this.reset();
  }

  get calibrating() {
    return this.calibration !== null;
  }

  calibrationProgress(tMs) {
    const c = this.calibration;
    if (!c || c.start === null) return 0;
    return Math.max(0, Math.min(1, (tMs / 1000 - c.start) / this.cfg.calibrationSeconds));
  }

  /**
   * Feed one frame. `landmarks` may be null when nobody is detected.
   * `aspect` = image height / width: y is multiplied by it so that one unit
   * is the same physical distance horizontally and vertically.
   */
  update(landmarks, tMs, aspect = 0.75) {
    const o = this.out;
    const cfg = this.cfg;
    const t = tMs / 1000;
    o.pepper = false;
    o.pepperDir = 0;

    const vis = (i) => landmarks?.[i]?.visibility ?? 1;
    if (!landmarks || vis(LM.L_SHOULDER) < cfg.minVisibility || vis(LM.R_SHOULDER) < cfg.minVisibility) {
      o.present = false;
      o.x = 0; o.y = 0;
      o.handsUp = false; o.handsUpHeld = 0; o.crouch = false;
      o.armL = false; o.armR = false; o.pepperPose = 0; o.body = null;
      this.handsUpSince = null;
      this.prev = null;
      this.smooth = null;
      this.arm = { l: false, r: false };
      this.armSince = { l: null, r: null };
      this.armBlocked = { l: false, r: false };
      this.pepperSide = 0;
      if (this.calibration) {
        // you left the picture: calibration starts again when you are back
        this.calibration.start = null;
        this.calibration.samples = [];
      }
      return o;
    }
    o.present = true;

    // 1. smooth the few landmarks we use (exponential moving average)
    const a = cfg.smoothing;
    if (!this.smooth) this.smooth = {};
    for (const i of TRACKED) {
      const p = landmarks[i];
      const py = p.y * aspect;
      const s = this.smooth[i];
      this.smooth[i] = s
        ? { x: s.x + (p.x - s.x) * a, y: s.y + (py - s.y) * a, v: vis(i) }
        : { x: p.x, y: py, v: vis(i) };
    }
    const P = this.smooth;
    o.points = P;
    const sh = { x: (P[LM.L_SHOULDER].x + P[LM.R_SHOULDER].x) / 2, y: (P[LM.L_SHOULDER].y + P[LM.R_SHOULDER].y) / 2 };
    const sw = Math.hypot(P[LM.L_SHOULDER].x - P[LM.R_SHOULDER].x, P[LM.L_SHOULDER].y - P[LM.R_SHOULDER].y);
    // hips are the best "body height" marker (they do not move when you raise
    // your arms), but they are only usable when the camera sees them
    const hipsVisible = P[LM.L_HIP].v > 0.6 && P[LM.R_HIP].v > 0.6;
    const hipY = (P[LM.L_HIP].y + P[LM.R_HIP].y) / 2;

    // 2. both hands above the nose (works before calibration: used to start)
    const handsUp = P[LM.L_WRIST].v > 0.3 && P[LM.R_WRIST].v > 0.3 &&
      P[LM.L_WRIST].y < P[LM.NOSE].y && P[LM.R_WRIST].y < P[LM.NOSE].y;
    if (handsUp) this.handsUpSince ??= t;
    else this.handsUpSince = null;
    o.handsUp = handsUp;
    o.handsUpHeld = handsUp ? t - this.handsUpSince : 0;

    // 3. calibration: record the neutral pose for a moment (arms down).
    //    The median ignores a few glitchy frames.
    if (this.calibration) {
      const c = this.calibration;
      if (handsUp) {
        c.start = null;
        c.samples = [];
      } else {
        if (c.start === null) c.start = t;
        c.samples.push({ x: sh.x, y: sh.y, sw, hy: hipsVisible ? hipY : null });
        if (t - c.start >= cfg.calibrationSeconds) {
          const med = (k) => {
            const v = c.samples.map((s) => s[k]).filter((x) => x !== null).sort((p, q) => p - q);
            return v.length > c.samples.length / 2 ? v[Math.floor(v.length / 2)] : null;
          };
          this.baseline = { x: med('x'), y: med('y'), sw: med('sw'), hy: med('hy') };
          this.calibration = null;
        }
      }
      o.x = 0; o.y = 0; o.calibrated = false;
      this.prev = null;
      return o;
    }

    if (!this.baseline) {
      o.x = 0;
      o.y = handsUp ? -1 : 0;
      o.calibrated = false;
      this.prev = null;
      return o;
    }
    o.calibrated = true;

    // 4. body height relative to the calibrated neutral pose (for the squat)
    const b = this.baseline;
    b.sw += (sw - b.sw) * cfg.scaleFollow;
    const unit = b.sw;
    // body height marker: hips if visible now and at calibration, else shoulders
    const useHips = hipsVisible && b.hy !== null;
    const anchor = useHips ? hipY : sh.y;
    const anchorBase = useHips ? b.hy : b.y;
    const lift = (anchorBase - anchor) / unit;   // + = body higher than normal
    let vUp = 0;
    if (this.prev && this.prev.useHips === useHips && t > this.prev.t) {
      vUp = (this.prev.y - anchor) / (t - this.prev.t) / unit;
    }
    this.prev = { y: anchor, t, useHips };

    // 5. arms. The camera image is NOT mirrored: your left is +x.
    //    `side(p)` = how far a point is towards YOUR right (= screen right).
    const side = (p) => (sh.x - p.x) / unit;
    const Lw = P[LM.L_WRIST];
    const Rw = P[LM.R_WRIST];
    const Ls = P[LM.L_SHOULDER];
    const Rs = P[LM.R_SHOULDER];
    const stretch = (k, wrist, shoulder, out) => {
      const reach = this.arm[k] ? cfg.armOutExit : cfg.armOut;
      const on = wrist.v > 0.3 && out > reach && Math.abs(wrist.y - shoulder.y) / unit < cfg.armLevel;
      this.arm[k] = on;
      if (on) this.armSince[k] ??= t;
      else this.armSince[k] = null;
      if (!on) this.armBlocked[k] = false;
      return on && !this.armBlocked[k] && t - this.armSince[k] >= cfg.armHold;
    };
    const left = stretch('l', Lw, Ls, (Lw.x - Ls.x) / unit);
    const right = stretch('r', Rw, Rs, (Rs.x - Rw.x) / unit);

    // both wrists past the body centre on the same side = pepper that way
    const sl = side(Lw);
    const sr = side(Rw);
    const wristsSeen = Lw.v > 0.3 && Rw.v > 0.3;
    let pepperPose = 0;
    if (wristsSeen && !handsUp) {
      if (sl > cfg.pepperReach && sr > cfg.pepperReach) pepperPose = 1;
      else if (sl < -cfg.pepperReach && sr < -cfg.pepperReach) pepperPose = -1;
    }
    if (pepperPose !== 0 && pepperPose !== this.pepperSide && t - this.lastPepperAt > cfg.pepperCooldown) {
      o.pepper = true;
      o.pepperDir = pepperPose;
      this.lastPepperAt = t;
    }
    this.pepperSide = pepperPose;
    // coming out of the pepper pose, the pointing arm stays out a moment:
    // that must not be read as "walk towards the enemy"
    if (pepperPose) this.armBlocked = { l: true, r: true };

    // 6. squat (shoulders or hips clearly lower)
    const drop = Math.max(-lift, (sh.y - b.y) / unit);
    if (!this.crouching && drop > cfg.crouchEnter) this.crouching = true;
    else if (this.crouching && drop < cfg.crouchExit) this.crouching = false;

    // 7. slowly follow posture changes while standing still and normally
    if (!this.crouching && !handsUp && Math.abs(lift) < 0.35 && Math.abs(vUp) < 0.3) {
      b.y += (sh.y - b.y) * cfg.baselineFollow;
      if (useHips) b.hy += (hipY - b.hy) * cfg.baselineFollow;
    }

    // one arm only gives a direction; both arms out (T pose), both on one
    // side (pepper) or hands up give none
    o.x = handsUp || pepperPose ? 0 : left && !right ? -1 : right && !left ? 1 : 0;
    o.y = handsUp ? -1 : this.crouching ? 1 : 0;
    o.crouch = this.crouching;
    o.lift = lift;
    o.armL = left;
    o.armR = right;
    o.pepperPose = pepperPose;
    o.body = { x: sh.x, y: sh.y, unit };
    return o;
  }
}
