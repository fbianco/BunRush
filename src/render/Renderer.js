// ---------------------------------------------------------------------------
// Renderer: draws one frame from the current state. It only *reads* the game;
// it never changes rules. Static scenery (background, girders, ladders,
// plates) is drawn once per level into an offscreen canvas and then copied,
// which keeps every frame cheap.
// ---------------------------------------------------------------------------
import {
  VIEW_W, VIEW_H, TILE, LEVEL_X, LEVEL_Y, FLOOR_THICK, INGREDIENT_W,
  FONT, GAME_TITLE, STUDIO, surfaceY,
} from '../config.js';
import {
  drawChef, drawEnemy, drawIngredientShape, drawPlate, drawShaker, drawHat,
  drawStickFigure, drawStar,
} from './sprites.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ratio = 1;
    this.staticLayer = document.createElement('canvas');
    this.staticKey = '';
    this.bgLayer = document.createElement('canvas');
    this.bgKey = '';
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const scale = Math.max(0.2, Math.min(box.width / VIEW_W, box.height / VIEW_H));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    this.canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
    this.canvas.width = Math.floor(VIEW_W * scale * dpr);
    this.canvas.height = Math.floor(VIEW_H * scale * dpr);
    this.ratio = scale * dpr;
    this.staticKey = '';
    this.bgKey = '';
  }

  // ---- frame ---------------------------------------------------------------
  render(app) {
    const ctx = this.ctx;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (app.screen === 'game') this.drawGame(app);
    else this.drawTitle(app);
  }

  // ---- background (shared by title and game) ------------------------------
  ensureBackground() {
    const key = `${this.ratio}`;
    if (this.bgKey === key) return;
    this.bgKey = key;
    const c = this.bgLayer;
    c.width = Math.floor(VIEW_W * this.ratio);
    c.height = Math.floor(VIEW_H * this.ratio);
    const g = c.getContext('2d');
    g.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#120c2c');
    grad.addColorStop(0.55, '#1f1240');
    grad.addColorStop(1, '#2a0f35');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // diner wall tiles
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 1;
    for (let x = 0; x < VIEW_W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, VIEW_H); g.stroke(); }
    for (let y = 0; y < VIEW_H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(VIEW_W, y); g.stroke(); }
    // warm hanging-lamp glows
    for (const lx of [150, 480, 810]) {
      const r = g.createRadialGradient(lx, 40, 10, lx, 120, 330);
      r.addColorStop(0, 'rgba(255,190,110,0.22)');
      r.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // checkered counter at the bottom
    for (let x = 0; x < VIEW_W; x += 20) {
      for (let y = VIEW_H - 40; y < VIEW_H; y += 20) {
        g.fillStyle = ((x + y) / 20) % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.25)';
        g.fillRect(x, y, 20, 20);
      }
    }
    // vignette
    const v = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  ensureStatic(game) {
    const key = `${game.levelVersion}:${this.ratio}`;
    if (this.staticKey === key) return;
    this.ensureBackground();
    this.staticKey = key;
    const c = this.staticLayer;
    c.width = Math.floor(VIEW_W * this.ratio);
    c.height = Math.floor(VIEW_H * this.ratio);
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.bgLayer, 0, 0);
    g.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    g.translate(LEVEL_X, LEVEL_Y);
    const L = game.level;

    // ladders (behind the girders)
    for (const l of L.ladders) {
      const x = l.x;
      const y0 = l.topY;
      const y1 = l.bottomY + FLOOR_THICK;
      g.shadowColor = 'rgba(255,170,60,0.5)';
      g.shadowBlur = 6;
      g.strokeStyle = '#d9822b';
      g.lineWidth = 3;
      for (const s of [-10, 10]) { g.beginPath(); g.moveTo(x + s, y0); g.lineTo(x + s, y1); g.stroke(); }
      g.shadowBlur = 0;
      g.strokeStyle = '#ffb35c';
      g.lineWidth = 3;
      for (let y = y0 + 10; y < y1 - 2; y += 12) {
        g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.stroke();
      }
      g.strokeStyle = 'rgba(255,240,200,0.6)';
      g.lineWidth = 1;
      for (const s of [-11, 9]) { g.beginPath(); g.moveTo(x + s, y0); g.lineTo(x + s, y1); g.stroke(); }
    }

    // girders
    for (const run of L.floorRuns()) {
      const x = run.from * TILE + 1;
      const w = (run.to - run.from + 1) * TILE - 2;
      const y = surfaceY(run.row);
      g.shadowColor = 'rgba(80,200,255,0.55)';
      g.shadowBlur = 10;
      const gr = g.createLinearGradient(0, y, 0, y + FLOOR_THICK);
      gr.addColorStop(0, '#9fe8ff');
      gr.addColorStop(0.35, '#3fa7e0');
      gr.addColorStop(1, '#1d4f8f');
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(x, y, w, FLOOR_THICK, 3);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(10,30,70,0.8)';
      for (let rx = x + 8; rx < x + w - 4; rx += 16) {
        g.beginPath(); g.arc(rx, y + FLOOR_THICK / 2 + 0.5, 1.3, 0, Math.PI * 2); g.fill();
      }
    }

    // plates
    for (const p of game.plates) drawPlate(g, p.x, p.y, INGREDIENT_W + 16);
  }

  // ---- game screen ---------------------------------------------------------
  drawGame(app) {
    const ctx = this.ctx;
    const game = app.game;
    this.ensureStatic(game);
    ctx.save();
    let sx = 0;
    let sy = 0;
    if (game.shake > 0) {
      const s = game.shake * 6;
      sx = (Math.random() - 0.5) * s;
      sy = (Math.random() - 0.5) * s;
      ctx.fillStyle = '#120c2c';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.staticLayer, Math.round(sx * this.ratio), Math.round(sy * this.ratio));
    ctx.restore();
    ctx.translate(sx, sy);

    ctx.save();
    ctx.translate(LEVEL_X, LEVEL_Y);
    const t = game.time;

    // ingredients: plated / resting first, falling on top
    const order = [...game.ingredients].sort((a, b) => (a.state === 'falling') - (b.state === 'falling'));
    for (const ing of order) this.drawIngredient(ctx, ing);

    // pickup
    if (game.pickup) {
      const k = game.pickup;
      const blink = k.t > 7 && Math.floor(k.t * 6) % 2 === 0;
      if (!blink) drawShaker(ctx, k.x, k.y - 2 + Math.sin(k.t * 4) * 2, 1.1, 1);
    }

    // enemies
    for (const e of game.enemies) {
      const off = e.state === 'riding' ? 0 : game.standOffset(e.x, e.y);
      drawEnemy(ctx, e.kind, e.x, e.y + off, {
        t: e.anim, facing: e.facing, moving: e.state === 'walk',
        stunned: e.state === 'stunned',
        squashed: e.state === 'squashed' ? Math.min(1, e.stateT / 0.8) : undefined,
        spawn: e.state === 'spawn' ? e.stateT : undefined,
      });
    }

    // chef
    const p = game.player;
    const dying = game.state === 'dying' ? Math.min(1, game.stateTime / 1.6) : 0;
    const flicker = game.invulnerable > 0 && game.state === 'playing' && Math.floor(t * 12) % 2 === 0;
    if (!flicker) {
      drawChef(ctx, p.x, p.y + (p.onLadder ? 0 : game.standOffset(p.x, p.y)), {
        t: p.anim, facing: p.facing, moving: p.moving, climbing: p.onLadder && !dying,
        pepper: p.pepperAnim, dying,
      });
    }

    // pepper clouds glow (particles do the specks)
    for (const c of game.clouds) {
      const k = 1 - c.t / 0.65;
      const r = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 30);
      r.addColorStop(0, `rgba(230,230,240,${0.35 * k})`);
      r.addColorStop(1, 'rgba(230,230,240,0)');
      ctx.fillStyle = r;
      ctx.beginPath(); ctx.arc(c.x, c.y, 30, 0, Math.PI * 2); ctx.fill();
    }

    app.fx.draw(ctx);
    ctx.restore();
    ctx.restore();

    this.drawHud(game);
    this.drawGameOverlay(app);
  }

  drawIngredient(ctx, ing) {
    const squash = ing.bounce > 0 ? Math.sin(ing.bounce * Math.PI) * 0.18 : 0;
    for (let s = 0; s < 4; s++) {
      ctx.save();
      ctx.beginPath();
      // 0.5px overlap hides seams; outer segments get room for cheese drips
      const left = ing.x0 + s * TILE - (s === 0 ? 8 : 0.5);
      const right = ing.x0 + (s + 1) * TILE + (s === 3 ? 8 : 0.5);
      ctx.rect(left, ing.y - 40, right - left, 60);
      ctx.clip();
      const dip = ing.state === 'rest' && ing.pressed[s] ? 4 : 0;
      ctx.translate(0, dip);
      if (squash) {
        ctx.translate(0, ing.y);
        ctx.scale(1, 1 - squash);
        ctx.translate(0, -ing.y);
      }
      drawIngredientShape(ctx, ing.kind, ing.x0, ing.y, INGREDIENT_W, ing.h);
      ctx.restore();
    }
  }

  drawHud(game) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, 36);
    grad.addColorStop(0, 'rgba(10,6,25,0.95)');
    grad.addColorStop(1, 'rgba(25,12,50,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, 36);
    ctx.fillStyle = '#ff4f9a';
    ctx.fillRect(0, 35, VIEW_W, 2);

    text(ctx, 'SCORE', 18, 15, { size: 8, color: '#ff8fc0' });
    text(ctx, String(game.score).padStart(6, '0'), 18, 29, { size: 12 });
    text(ctx, 'HI', 190, 15, { size: 8, color: '#ff8fc0' });
    text(ctx, String(game.hiScore).padStart(6, '0'), 190, 29, { size: 12, color: '#ffe066' });
    text(ctx, `LEVEL ${game.levelNumber}`, 480, 15, { size: 8, color: '#ff8fc0', align: 'center' });
    text(ctx, game.level.name, 480, 29, { size: 10, align: 'center', color: '#9fe8ff' });

    for (let i = 0; i < Math.min(game.lives, 6); i++) drawHat(ctx, 664 + i * 22, 30, 1);
    drawShaker(ctx, 830, 31, 0.95);
    text(ctx, `x${game.pepper}`, 845, 29, { size: 12 });
  }

  drawGameOverlay(app) {
    const ctx = this.ctx;
    const game = app.game;
    const cx = VIEW_W / 2;
    const s = game.state;
    if (app.paused) {
      dim(ctx, 0.55);
      text(ctx, 'PAUSED', cx, 330, { size: 32, align: 'center', glow: '#ff4f9a' });
      text(ctx, app.pauseReason || 'PRESS P TO CONTINUE', cx, 380, { size: 12, align: 'center', color: '#9fe8ff' });
      return;
    }
    if (s === 'ready' || s === 'clear') band(ctx, 262, 140);
    if (s === 'ready') {
      text(ctx, `LEVEL ${game.levelNumber}`, cx, 300, { size: 28, align: 'center', glow: '#ff4f9a' });
      text(ctx, game.level.name, cx, 340, { size: 14, align: 'center', color: '#9fe8ff' });
      if (Math.floor(game.stateTime * 3) % 2 === 0) text(ctx, 'GET READY!', cx, 390, { size: 16, align: 'center', color: '#ffe066' });
    } else if (s === 'clear') {
      const k = Math.min(1, game.stateTime * 2);
      text(ctx, 'ORDER UP!', cx, 320, { size: 40 * k + 1, align: 'center', glow: '#7CFFB2', color: '#eaffef' });
      text(ctx, `LEVEL BONUS ${1000 * game.levelNumber}`, cx, 370, { size: 14, align: 'center', color: '#ffe066' });
    } else if (s === 'gameover') {
      dim(ctx, Math.min(0.6, game.stateTime));
      text(ctx, 'GAME OVER', cx, 320, { size: 40, align: 'center', glow: '#ff4f4f' });
      text(ctx, `SCORE ${game.score}`, cx, 370, { size: 14, align: 'center', color: '#ffe066' });
      if (game.stateTime > 2) text(ctx, 'RAISE BOTH HANDS OR PRESS ENTER', cx, 420, { size: 11, align: 'center', color: '#9fe8ff' });
    }
  }

  // ---- title & calibration -------------------------------------------------
  drawTitle(app) {
    const ctx = this.ctx;
    const t = app.time;
    this.ensureBackground();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bgLayer, 0, 0);
    ctx.restore();

    // logo
    const wob = Math.sin(t * 2) * 3;
    ctx.save();
    ctx.translate(VIEW_W / 2, 118 + wob);
    ctx.rotate(Math.sin(t * 1.3) * 0.015);
    ctx.font = `64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#3a0d2e';
    ctx.strokeText(GAME_TITLE, 0, 0);
    ctx.shadowColor = '#ff4f9a';
    ctx.shadowBlur = 24;
    const lg = ctx.createLinearGradient(0, -60, 0, 4);
    lg.addColorStop(0, '#fff6a8');
    lg.addColorStop(0.5, '#ffc23d');
    lg.addColorStop(1, '#ff7a1a');
    ctx.fillStyle = lg;
    ctx.fillText(GAME_TITLE, 0, 0);
    ctx.restore();
    text(ctx, 'THE BODY-CONTROLLED BURGER ARCADE', VIEW_W / 2, 160, { size: 11, align: 'center', color: '#9fe8ff' });

    if (app.screen === 'calibrate') {
      this.drawCalibration(app);
    } else {
      this.drawHowTo(t);
      this.drawStartPrompt(app);
    }

    // little chase along the counter
    const lane = 668;
    const span = VIEW_W + 300;
    const cxp = ((t * 90) % span) - 100;
    drawChef(ctx, cxp, lane, { t, facing: 1, moving: true });
    drawEnemy(ctx, 'onion', cxp - 60, lane, { t, facing: 1, moving: true });
    drawEnemy(ctx, 'chili', cxp - 105, lane, { t: t + 1, facing: 1, moving: true });
    drawEnemy(ctx, 'meatball', cxp - 150, lane, { t: t + 2, facing: 1, moving: true });

    text(ctx, `(C) 2026 ${STUDIO.toUpperCase()}`, VIEW_W / 2, 708, { size: 8, align: 'center', color: 'rgba(255,255,255,0.5)' });
    if (app.hiScore) text(ctx, `HI ${String(app.hiScore).padStart(6, '0')}`, VIEW_W - 16, 24, { size: 10, align: 'right', color: '#ffe066' });
  }

  drawHowTo(t) {
    const ctx = this.ctx;
    const cards = [
      ['arm', 'ONE ARM OUT SIDEWAYS', 'WALK THAT WAY'],
      ['hands', 'BOTH HANDS UP', 'CLIMB UP'],
      ['squat', 'SQUAT', 'CLIMB DOWN'],
      ['pepper', 'BOTH ARMS ONE SIDE', 'PEPPER THAT WAY'],
    ];
    const w = 200;
    const gap = 20;
    const x0 = (VIEW_W - (w * 4 + gap * 3)) / 2;
    cards.forEach(([pose, a, b], i) => {
      const x = x0 + i * (w + gap);
      const y = 200;
      ctx.fillStyle = 'rgba(20,10,45,0.75)';
      ctx.strokeStyle = 'rgba(159,232,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, w, 210, 14); ctx.fill(); ctx.stroke();
      drawStickFigure(ctx, x + w / 2, y + 110, pose, t + i * 0.7, '#ffffff');
      const side = Math.sin((t + i * 0.7) * 1.5) > 0 ? 1 : -1;
      const out = (Math.sin((t + i * 0.7) * 3) + 1) / 2 > 0.25;
      if (pose === 'arm' && out) {
        text(ctx, side > 0 ? '>' : '<', x + w / 2 + side * 62, y + 98, { size: 16, align: 'center', color: '#ffe066' });
      }
      if (pose === 'pepper' && out) {
        for (let k = 0; k < 5; k++) drawStar(ctx, x + w / 2 + side * (44 + k * 6), y + 84 + (k % 2) * 6, 2.5, '#bbbbbb');
      }
      text(ctx, a, x + w / 2, y + 172, { size: 9, align: 'center', color: '#9fe8ff' });
      text(ctx, b, x + w / 2, y + 194, { size: 11, align: 'center', color: '#ffe066' });
    });
    text(ctx, 'WALK OVER EVERY BURGER LAYER TO DROP IT ONTO THE PLATES', VIEW_W / 2, 446, { size: 9, align: 'center', color: '#ffffff' });
    text(ctx, 'DODGE THE FOOD GANG - OR SQUASH THEM UNDER A FALLING BUN!', VIEW_W / 2, 466, { size: 9, align: 'center', color: '#ffffff' });
  }

  drawStartPrompt(app) {
    const ctx = this.ctx;
    const t = app.time;
    const y = 530;
    if (app.bodyReady) {
      const k = app.startHold;
      text(ctx, 'RAISE BOTH HANDS TO START', VIEW_W / 2, y, {
        size: 16, align: 'center', color: Math.floor(t * 2.5) % 2 ? '#ffffff' : '#ffe066', glow: '#ff4f9a',
      });
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(VIEW_W / 2 - 160, y + 20, 320, 10);
      ctx.fillStyle = '#7CFFB2';
      ctx.fillRect(VIEW_W / 2 - 160, y + 20, 320 * k, 10);
      if (!app.personVisible) text(ctx, 'STEP BACK UNTIL THE CAMERA SEES YOUR UPPER BODY', VIEW_W / 2, y + 56, { size: 9, align: 'center', color: '#ff8fc0' });
      text(ctx, 'OR PRESS ENTER', VIEW_W / 2, y + 80, { size: 9, align: 'center', color: 'rgba(255,255,255,0.6)' });
    } else {
      text(ctx, 'PRESS ENTER TO START', VIEW_W / 2, y, {
        size: 16, align: 'center', color: Math.floor(t * 2.5) % 2 ? '#ffffff' : '#ffe066', glow: '#ff4f9a',
      });
      text(ctx, app.poseMessage || '', VIEW_W / 2, y + 36, { size: 9, align: 'center', color: '#ff8fc0' });
      text(ctx, 'KEYS: ARROWS MOVE - SPACE PEPPER', VIEW_W / 2, y + 60, { size: 9, align: 'center', color: 'rgba(255,255,255,0.6)' });
    }
  }

  drawCalibration(app) {
    const ctx = this.ctx;
    const cx = VIEW_W / 2;
    ctx.fillStyle = 'rgba(20,10,45,0.8)';
    ctx.strokeStyle = 'rgba(124,255,178,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(cx - 330, 200, 660, 300, 18); ctx.fill(); ctx.stroke();
    text(ctx, 'CALIBRATION', cx, 250, { size: 22, align: 'center', glow: '#7CFFB2', color: '#eaffef' });
    drawStickFigure(ctx, cx, 330, 'idle', app.time, '#7CFFB2');
    if (!app.personVisible) {
      text(ctx, 'I CAN\'T SEE YOU YET', cx, 410, { size: 12, align: 'center', color: '#ff8fc0' });
      text(ctx, 'STEP BACK SO SHOULDERS AND HANDS ARE VISIBLE', cx, 436, { size: 9, align: 'center', color: '#ffffff' });
    } else {
      text(ctx, 'STAND IN THE MIDDLE, ARMS DOWN, STAY STILL', cx, 410, { size: 11, align: 'center', color: '#ffffff' });
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(cx - 200, 436, 400, 14);
      ctx.fillStyle = '#7CFFB2';
      ctx.fillRect(cx - 200, 436, 400 * app.calibration, 14);
    }
    text(ctx, 'THIS SPOT BECOMES "STANDING STILL"', cx, 478, { size: 8, align: 'center', color: 'rgba(255,255,255,0.6)' });
  }
}

// ---- small helpers -------------------------------------------------------
export function text(ctx, str, x, y, { size = 12, color = '#ffffff', align = 'left', glow = null } = {}) {
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(str, x + Math.max(1, size / 12), y + Math.max(1, size / 12));
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.8;
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function band(ctx, y, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(5,2,15,0)');
  g.addColorStop(0.2, 'rgba(5,2,15,0.72)');
  g.addColorStop(0.8, 'rgba(5,2,15,0.72)');
  g.addColorStop(1, 'rgba(5,2,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, VIEW_W, h);
}

function dim(ctx, a) {
  ctx.fillStyle = `rgba(5,2,15,${a})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
