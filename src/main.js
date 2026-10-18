// ---------------------------------------------------------------------------
// main.js - wires everything together and runs the loop.
//
//   camera -> PoseTracker -> GestureInterpreter --\
//                                                  >-- InputManager -> Game -> Renderer
//   keyboard ------------------------------------/                      |
//                                                                     Sound
//
// App screens: boot (click to enable camera + sound) -> title -> calibrate -> game
// The game logic runs at a fixed 60 updates per second ("fixed timestep"),
// independent of the monitor refresh rate; drawing happens once per frame.
// ---------------------------------------------------------------------------
import { GESTURE } from './config.js';
import { Game } from './game/Game.js';
import { Renderer } from './render/Renderer.js';
import { Particles } from './render/Particles.js';
import { Sound } from './audio/Sound.js';
import { Keyboard } from './input/Keyboard.js';
import { GestureInterpreter } from './input/GestureInterpreter.js';
import { PoseTracker } from './input/PoseTracker.js';
import { InputManager } from './input/InputManager.js';

const $ = (id) => document.getElementById(id);

const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const sound = new Sound();
const fx = new Particles();
const game = new Game({ sound, fx, storage });
const renderer = new Renderer($('game'));
const keyboard = new Keyboard(window);
const gestures = new GestureInterpreter();
const pose = new PoseTracker($('cam'), $('cam-overlay'));
const input = new InputManager(keyboard, gestures);

const app = {
  screen: 'boot',
  time: 0,
  game,
  fx,
  paused: false,
  pauseReason: '',
  startHold: 0,
  calibration: 0,
  get bodyReady() { return pose.ready; },
  get personVisible() { return gestures.out.present; },
  get poseMessage() { return pose.message; },
  get hiScore() { return game.hiScore; },
};

let missingSince = null;
let backSince = null;
let startLock = 0; // avoid instantly restarting with the same raised hands

// ---- boot: one click is needed by browsers to allow sound -----------------
$('boot-btn').addEventListener('click', () => {
  $('boot').classList.add('hidden');
  sound.init();
  sound.play('start');
  app.screen = 'title';
  startPose();
});

async function startPose() {
  setStatus();
  await pose.start();
  input.bodyEnabled = pose.ready;
  setStatus();
}

function setStatus() {
  const el = $('cam-status');
  el.textContent = pose.message;
  el.className = pose.ready ? 'ok' : pose.status === 'error' ? 'err' : '';
  $('cam-panel').classList.toggle('no-cam', pose.status === 'error');
}

// ---- screens ----------------------------------------------------------------
function beginGame() {
  keyboard.clearPressed();
  game.newGame();
  app.screen = 'game';
  app.paused = false;
}

function beginCalibration() {
  // recalibrating in the middle of a game returns to that game afterwards
  app.resumeGame = app.screen === 'game' && game.state !== 'gameover';
  gestures.startCalibration();
  app.screen = 'calibrate';
  sound.play('ready');
}

function updateApp(dt, now) {
  app.time += dt;
  startLock = Math.max(0, startLock - dt);

  // global keys
  if (keyboard.consume('KeyM')) sound.toggleMute();
  if (keyboard.consume('KeyV')) {
    $('cam-panel').classList.toggle('collapsed');
    renderer.resize();
  }
  if (keyboard.consume('KeyR') && pose.status === 'error') startPose();
  if (keyboard.consume('KeyC') && pose.ready && app.screen !== 'boot') beginCalibration();

  if (app.screen === 'title') {
    const held = gestures.out.handsUpHeld || 0;
    app.startHold = startLock > 0 ? 0 : Math.min(1, held / GESTURE.handsUpToStart);
    if (keyboard.consume('Enter')) {
      if (pose.ready && !gestures.baseline) beginCalibration();
      else beginGame();
    } else if (pose.ready && app.startHold >= 1) {
      sound.play('start');
      if (!gestures.baseline) beginCalibration();
      else beginGame();
    }
    keyboard.clearPressed();
    return;
  }

  if (app.screen === 'calibrate') {
    app.calibration = gestures.calibrationProgress(now);
    if (!gestures.calibrating) {
      sound.play('start');
      if (app.resumeGame) {
        app.screen = 'game';
        app.paused = false;
      } else {
        beginGame();
      }
    }
    if (keyboard.consume('Escape')) app.screen = app.resumeGame ? 'game' : 'title';
    return;
  }

  if (app.screen === 'game') {
    // pause by key, or automatically when you walk out of the camera view
    if (keyboard.consume('KeyP')) {
      app.paused = !app.paused;
      app.pauseReason = '';
    }
    if (input.bodyEnabled && game.state === 'playing') {
      if (!gestures.out.present) {
        missingSince ??= now;
        if (now - missingSince > 1500 && !app.paused) {
          app.paused = true;
          app.pauseReason = 'STEP BACK INTO THE CAMERA VIEW';
        }
      } else {
        missingSince = null;
      }
    }
    if (app.paused && app.pauseReason && gestures.out.present) {
      backSince ??= now;
      if (now - backSince > 600) { app.paused = false; app.pauseReason = ''; }
    } else {
      backSince = null;
    }
    if (app.paused) return;
    if (game.state !== 'gameover') keyboard.consume('Enter');

    game.update(dt, input.intent());

    if (game.state === 'gameover' && game.stateTime > 2) {
      const restart = keyboard.consume('Enter') || (pose.ready && gestures.out.handsUpHeld > GESTURE.handsUpToStart);
      if (restart) {
        startLock = 1.5;
        beginGame();
      } else if (game.stateTime > 12) {
        app.screen = 'title';
        startLock = 1.5;
      }
    }
  }
}

// ---- camera panel (DOM) -------------------------------------------------------
const pills = {
  left: $('pill-left'), right: $('pill-right'), up: $('pill-up'), down: $('pill-down'), pepper: $('pill-pepper'),
};
let pepperFlash = 0;

function updatePanel(dt) {
  const o = gestures.out;
  if (o.pepper) pepperFlash = 0.4;
  pepperFlash = Math.max(0, pepperFlash - dt);
  const kx = keyboard.x;
  const ky = keyboard.y;
  pills.left.classList.toggle('on', o.x < 0 || kx < 0);
  pills.right.classList.toggle('on', o.x > 0 || kx > 0);
  pills.up.classList.toggle('on', o.y < 0 || ky < 0);
  pills.down.classList.toggle('on', o.y > 0 || ky > 0);
  pills.pepper.classList.toggle('on', pepperFlash > 0);
  if (pose.ready) {
    $('cam-status').textContent = !o.present
      ? 'I can\'t see you - step back'
      : gestures.calibrating ? 'Calibrating... stand still'
        : o.calibrated ? `Tracking (${Math.round(pose.fps)} fps)` : 'Tracking - raise both hands to start';
  }
  pose.drawOverlay(gestures);
}

// ---- the loop -------------------------------------------------------------------
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // 1. read the body (at most once per new camera frame)
  const lm = pose.detect(now);
  if (lm !== undefined) {
    const v = $('cam');
    const aspect = v.videoWidth ? v.videoHeight / v.videoWidth : 0.75;
    input.onGestureFrame(gestures.update(lm, now, aspect));
  }

  // 2. fixed-step simulation
  acc += dt;
  while (acc >= STEP) {
    updateApp(STEP, now);
    acc -= STEP;
  }

  // 3. draw
  updatePanel(dt);
  renderer.render(app);
  requestAnimationFrame(frame);
}

document.fonts?.load('16px "Press Start 2P"').finally(() => requestAnimationFrame(frame));
if (!document.fonts) requestAnimationFrame(frame);

// handy for debugging in the browser console
window.bunRush = { app, game, gestures, pose, sound };
