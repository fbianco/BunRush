// ---------------------------------------------------------------------------
// Sprites, drawn with vector paths and gradients instead of bitmaps.
// This is the "improved graphics" part: everything scales crisply to any
// screen, and animation is just maths on time `t`.
// Every function draws around (x, y) = the character's feet.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

export function shadow(ctx, x, y, rx = 13) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ellipse(ctx, x, y + 1, rx, 3.5);
  ctx.fill();
}

// ---- the chef --------------------------------------------------------------
export function drawChef(ctx, x, y, o) {
  const t = o.t ?? 0;
  ctx.save();
  ctx.translate(x, y);
  if (o.dying) {
    ctx.translate(0, -18);
    ctx.rotate(o.dying * TAU * 1.5);
    ctx.scale(1 - o.dying * 0.4, 1 - o.dying * 0.4);
    ctx.translate(0, 18);
  } else {
    shadow(ctx, 0, 0, 12);
  }
  const walk = o.moving ? Math.sin(t * 14) : 0;
  const bob = o.moving ? Math.abs(Math.sin(t * 14)) * 1.6 : Math.sin(t * 3) * 0.6;
  const hop = o.pepper > 0 ? Math.sin((o.pepper / 0.45) * Math.PI) * 8 : 0;
  ctx.translate(0, -bob - hop);
  if (!o.climbing) ctx.scale(o.facing || 1, 1);

  const climbPhase = o.climbing && o.moving ? Math.sin(t * 12) : 0;

  // legs
  ctx.fillStyle = '#2b3a67';
  const legL = o.climbing ? climbPhase * 4 : walk * 4;
  const legR = o.climbing ? -climbPhase * 4 : -walk * 4;
  roundRect(ctx, -7 + legL * 0.6, -12 + Math.max(0, -legL) * 0.4, 6, 12, 2); ctx.fill();
  roundRect(ctx, 1 + legR * 0.6, -12 + Math.max(0, -legR) * 0.4, 6, 12, 2); ctx.fill();
  // shoes
  ctx.fillStyle = '#1b1b25';
  roundRect(ctx, -8 + legL * 0.6, -3, 8, 4, 2); ctx.fill();
  roundRect(ctx, 0 + legR * 0.6, -3, 8, 4, 2); ctx.fill();

  // coat
  ctx.fillStyle = vgrad(ctx, -32, -10, ['#ffffff', '#e8ecf5', '#c9d0e0']);
  roundRect(ctx, -11, -32, 22, 23, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,50,80,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (!o.climbing) {
    ctx.fillStyle = '#c33';
    for (const by of [-25, -19, -13]) { ellipse(ctx, 3, by, 1.3, 1.3); ctx.fill(); }
  } else {
    ctx.strokeStyle = 'rgba(40,50,80,0.25)';
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -11); ctx.stroke();
  }

  // arms
  ctx.strokeStyle = '#e8ecf5';
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  const arm = (sx, ex, ey) => {
    ctx.beginPath(); ctx.moveTo(sx, -27); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#f5c9a0';
    ellipse(ctx, ex, ey, 3.2, 3.2); ctx.fill();
  };
  if (o.climbing) {
    arm(-9, -10, -40 + climbPhase * 5);
    arm(9, 10, -40 - climbPhase * 5);
  } else if (o.pepper > 0) {
    arm(-9, -12, -16 - walk * 3);
    arm(9, 22, -30);
    // pepper shaker in hand
    ctx.fillStyle = '#d9dde8';
    roundRect(ctx, 20, -42, 8, 12, 2); ctx.fill();
    ctx.fillStyle = '#9aa3b5';
    roundRect(ctx, 20, -45, 8, 4, 2); ctx.fill();
  } else {
    arm(-9, -13 - walk * 3, -15);
    arm(9, 13 + walk * 3, -15);
  }

  // neckerchief
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(-7, -32); ctx.lineTo(7, -32); ctx.lineTo(0, -26); ctx.closePath();
  ctx.fill();

  // head
  ctx.fillStyle = vgrad(ctx, -47, -31, ['#ffd9b5', '#f2b98f']);
  ellipse(ctx, 0, -39, 9, 8.5);
  ctx.fill();
  if (!o.climbing) {
    // face (looking right; the whole sprite is mirrored for left)
    const blink = Math.sin(t * 1.7) > 0.97;
    ctx.fillStyle = '#20202a';
    if (blink) {
      ctx.fillRect(1, -41, 3, 1.2); ctx.fillRect(5.5, -41, 3, 1.2);
    } else {
      ellipse(ctx, 2.8, -40.5, 1.4, 1.9); ctx.fill();
      ellipse(ctx, 7, -40.5, 1.4, 1.9); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,110,110,0.55)';
    ellipse(ctx, -1.5, -36.5, 2.4, 1.5); ctx.fill();
    ctx.strokeStyle = '#7a3b2a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(5, -36.5, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // hair tuft
    ctx.fillStyle = '#d2691e';
    ellipse(ctx, -7, -40, 2.5, 3.5); ctx.fill();
  } else {
    ctx.fillStyle = '#d2691e';
    ellipse(ctx, 0, -37, 8, 4.5); ctx.fill();
  }

  // toque (chef hat)
  ctx.fillStyle = vgrad(ctx, -64, -45, ['#ffffff', '#eef1f8', '#d6dbe8']);
  roundRect(ctx, -8, -50, 16, 7, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-5, -54, 6, 0, TAU);
  ctx.arc(5, -54, 6, 0, TAU);
  ctx.arc(0, -59, 6.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,90,120,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-8, -46.5); ctx.lineTo(8, -46.5); ctx.stroke();

  ctx.restore();

  if (o.dying) {
    // dizzy stars
    for (let i = 0; i < 4; i++) {
      const a = t * 5 + (i * TAU) / 4;
      drawStar(ctx, x + Math.cos(a) * 16, y - 50 + Math.sin(a) * 5, 4, '#ffe066');
    }
  }
}

export function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function eyes(ctx, cx, cy, gap, r, facing, angry, dizzy, t) {
  for (const s of [-1, 1]) {
    const ex = cx + s * gap;
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, ex, cy, r, r * 1.15); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    if (dizzy) {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let a = 0; a < TAU * 1.5; a += 0.4) {
        const rr = (a / (TAU * 1.5)) * r * 0.8;
        ctx.lineTo(ex + Math.cos(a + t * 8) * rr, cy + Math.sin(a + t * 8) * rr);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#15151f';
      ellipse(ctx, ex + facing * r * 0.35, cy + r * 0.1, r * 0.5, r * 0.6); ctx.fill();
      ctx.fillStyle = '#fff';
      ellipse(ctx, ex + facing * r * 0.35 - 1, cy - r * 0.2, r * 0.18, r * 0.18); ctx.fill();
    }
    if (angry && !dizzy) {
      ctx.strokeStyle = '#2a0f0f'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - s * r * 0.9, cy - r * 1.5);
      ctx.lineTo(ex + s * r * 0.7, cy - r * 1.05);
      ctx.stroke();
    }
  }
}

function feet(ctx, t, color, moving) {
  const w = moving ? Math.sin(t * 16) * 3 : 0;
  ctx.fillStyle = color;
  ellipse(ctx, -5 + w, -1.5, 4, 2.2); ctx.fill();
  ellipse(ctx, 5 - w, -1.5, 4, 2.2); ctx.fill();
}

// ---- enemies ---------------------------------------------------------------
export function drawEnemy(ctx, kind, x, y, o) {
  const t = o.t ?? 0;
  const dizzy = o.stunned;
  const facing = o.facing || 1;
  ctx.save();
  ctx.translate(x, y);
  if (o.squashed !== undefined) {
    const k = o.squashed;
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.scale(1 + k * 0.8, Math.max(0.15, 1 - k));
  }
  if (o.spawn !== undefined) {
    const k = Math.min(1, o.spawn / 0.7);
    ctx.globalAlpha = k;
    ctx.scale(k, k);
  }
  shadow(ctx, 0, 0, 11);
  const moving = !dizzy && o.moving;

  if (kind === 'onion') {
    const bounce = moving ? Math.abs(Math.sin(t * 10)) * 3 : 0;
    ctx.translate(0, -bounce);
    feet(ctx, t, '#7a4a12', moving);
    const g = ctx.createRadialGradient(-4, -22, 2, 0, -16, 16);
    g.addColorStop(0, '#ffe29a'); g.addColorStop(0.6, '#e8a33d'); g.addColorStop(1, '#a8621a');
    ctx.strokeStyle = g;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(0, -16, 10.5, 0, TAU); ctx.stroke();
    // crunchy batter specks, rotating as it rolls
    ctx.fillStyle = 'rgba(120,60,10,0.6)';
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + (moving ? t * 6 * facing : 0);
      ellipse(ctx, Math.cos(a) * 10.5, -16 + Math.sin(a) * 10.5, 1.2, 1.2); ctx.fill();
    }
    eyes(ctx, 0, -27, 4.6, 3.6, facing, true, dizzy, t);
  } else if (kind === 'chili') {
    const hop = moving ? Math.abs(Math.sin(t * 9)) * 6 : 0;
    ctx.translate(0, -hop);
    feet(ctx, t, '#2f6b22', moving);
    ctx.save();
    ctx.rotate(Math.sin(t * 9) * (moving ? 0.08 : 0.03));
    const g = ctx.createLinearGradient(-9, 0, 9, 0);
    g.addColorStop(0, '#ff6b5b'); g.addColorStop(0.5, '#e02b20'); g.addColorStop(1, '#8e130c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.bezierCurveTo(11, -33, 11, -14, 6, -6);
    ctx.bezierCurveTo(3, -1, -2, -1, -4, -4);
    ctx.bezierCurveTo(-11, -14, -11, -32, 0, -34);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, -4, -24, 2, 6); ctx.fill();
    // stem
    ctx.fillStyle = '#3fa34d';
    ctx.beginPath();
    ctx.moveTo(-6, -33); ctx.quadraticCurveTo(0, -38, 6, -33); ctx.quadraticCurveTo(0, -35, -6, -33);
    ctx.fill();
    ctx.strokeStyle = '#2f7a39'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -35); ctx.quadraticCurveTo(2, -41, 6, -42); ctx.stroke();
    eyes(ctx, 0, -24, 4, 3.4, facing, true, dizzy, t);
    // grin
    ctx.strokeStyle = '#3a0905'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-4, -14); ctx.quadraticCurveTo(0, -11, 4, -14); ctx.stroke();
    ctx.restore();
  } else {
    // meatball
    const roll = moving ? Math.sin(t * 8) * 1.5 : 0;
    ctx.translate(0, -Math.abs(roll));
    feet(ctx, t, '#4a2410', moving);
    const g = ctx.createRadialGradient(-5, -20, 2, 0, -15, 15);
    g.addColorStop(0, '#b06a3b'); g.addColorStop(0.7, '#7a3f1d'); g.addColorStop(1, '#4a220e');
    ctx.fillStyle = g;
    ellipse(ctx, 0, -15, 14, 13.5); ctx.fill();
    ctx.fillStyle = 'rgba(60,25,8,0.6)';
    for (const [sx, sy, r] of [[-7, -10, 2], [6, -8, 1.6], [-2, -5, 1.3], [8, -17, 1.4], [-9, -18, 1.2]]) {
      ellipse(ctx, sx, sy, r, r); ctx.fill();
    }
    // tomato sauce on top
    ctx.fillStyle = '#d62828';
    ctx.beginPath();
    ctx.moveTo(-10, -24);
    ctx.quadraticCurveTo(0, -33, 10, -24);
    ctx.quadraticCurveTo(8, -19, 6, -22);
    ctx.quadraticCurveTo(4, -17, 1, -22);
    ctx.quadraticCurveTo(-3, -18, -5, -22);
    ctx.quadraticCurveTo(-8, -19, -10, -24);
    ctx.fill();
    // parsley
    ctx.fillStyle = '#4caf50';
    ellipse(ctx, 2, -27, 2.4, 1.4); ctx.fill();
    eyes(ctx, 0, -15, 5, 4.2, facing, false, dizzy, t);
    ctx.strokeStyle = '#2a1206'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -8, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  }
  ctx.restore();

  if (dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * TAU) / 3;
      drawStar(ctx, x + Math.cos(a) * 12, y - 40 + Math.sin(a) * 4, 3.5, '#fff27a');
    }
  }
}

// ---- burger ingredients -------------------------------------------------------
// Each shape is drawn for the whole 4-tile width; the renderer clips it into
// 4 segments so pressed segments can sink independently.

const SEEDS = [[0.14, 0.55], [0.26, 0.3], [0.38, 0.55], [0.5, 0.25], [0.62, 0.5], [0.74, 0.3], [0.86, 0.55], [0.32, 0.75], [0.68, 0.75]];

export function drawIngredientShape(ctx, kind, x, yb, w, h) {
  switch (kind) {
    case 'bunTop': {
      ctx.beginPath();
      ctx.moveTo(x + 2, yb);
      ctx.bezierCurveTo(x + 1, yb - h * 0.95, x + w * 0.18, yb - h, x + w / 2, yb - h);
      ctx.bezierCurveTo(x + w * 0.82, yb - h, x + w - 1, yb - h * 0.95, x + w - 2, yb);
      ctx.closePath();
      ctx.fillStyle = vgrad(ctx, yb - h, yb, ['#ffd58a', '#e9a13f', '#b8661c']);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ellipse(ctx, x + w * 0.3, yb - h * 0.72, w * 0.16, h * 0.14); ctx.fill();
      ctx.fillStyle = '#fff4dc';
      for (const [sx, sy] of SEEDS) {
        ctx.save();
        ctx.translate(x + sx * w, yb - h * (1 - sy * 0.75) + 2);
        ctx.rotate(sx * 3);
        ellipse(ctx, 0, 0, 2.2, 1.1); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#8f4f15';
      ctx.fillRect(x + 3, yb - 2, w - 6, 2);
      break;
    }
    case 'bunBottom': {
      roundRect(ctx, x + 2, yb - h, w - 4, h, [3, 3, 7, 7]);
      ctx.fillStyle = vgrad(ctx, yb - h, yb, ['#f8dca6', '#e2a24a', '#a75e1b']);
      ctx.fill();
      ctx.fillStyle = '#fbe7c2';
      ctx.fillRect(x + 3, yb - h, w - 6, 3);
      break;
    }
    case 'patty': {
      roundRect(ctx, x + 1, yb - h, w - 2, h, 6);
      ctx.fillStyle = vgrad(ctx, yb - h, yb, ['#8a4a26', '#5c2c12', '#3d1c0a']);
      ctx.fill();
      ctx.strokeStyle = 'rgba(25,8,2,0.75)';
      ctx.lineWidth = 2;
      for (let gx = x + 12; gx < x + w - 6; gx += 18) {
        ctx.beginPath(); ctx.moveTo(gx, yb - h + 3); ctx.lineTo(gx + 7, yb - 3); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(200,120,70,0.35)';
      for (let gx = x + 7; gx < x + w - 4; gx += 13) {
        ellipse(ctx, gx, yb - h + 3 + ((gx * 7) % 5), 1.3, 0.9); ctx.fill();
      }
      break;
    }
    case 'lettuce': {
      ctx.beginPath();
      ctx.moveTo(x, yb - 2);
      for (let xx = x; xx <= x + w; xx += 4) ctx.lineTo(xx, yb - h + Math.sin(xx * 0.4) * 2.5);
      for (let xx = x + w; xx >= x; xx -= 4) ctx.lineTo(xx, yb + Math.sin(xx * 0.55) * 1.8);
      ctx.closePath();
      ctx.fillStyle = vgrad(ctx, yb - h - 2, yb + 2, ['#b6f27a', '#5fc23d', '#2f7d22']);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,255,200,0.55)';
      ctx.lineWidth = 1;
      for (let xx = x + 8; xx < x + w; xx += 16) {
        ctx.beginPath(); ctx.moveTo(xx, yb - 1); ctx.lineTo(xx + 4, yb - h + 2); ctx.stroke();
      }
      break;
    }
    case 'cheese': {
      ctx.fillStyle = vgrad(ctx, yb - h, yb + 6, ['#fff08a', '#ffc928', '#e8a200']);
      ctx.beginPath();
      ctx.moveTo(x - 2, yb - h);
      ctx.lineTo(x + w + 2, yb - h);
      ctx.lineTo(x + w + 2, yb);
      const drips = [0.12, 0.33, 0.58, 0.81];
      for (let i = drips.length - 1; i >= 0; i--) {
        const dx = x + drips[i] * w;
        ctx.lineTo(dx + 6, yb);
        ctx.quadraticCurveTo(dx + 3, yb + 9, dx, yb + 7);
        ctx.quadraticCurveTo(dx - 3, yb + 4, dx - 5, yb);
      }
      ctx.lineTo(x - 2, yb);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x, yb - h, w, 1.5);
      break;
    }
    case 'tomato': {
      roundRect(ctx, x + 2, yb - h, w - 4, h, 4);
      ctx.fillStyle = vgrad(ctx, yb - h, yb, ['#ff7a5c', '#e2372a', '#a81d12']);
      ctx.fill();
      for (let xx = x + 16; xx < x + w; xx += 32) {
        ctx.fillStyle = '#ff9f80';
        ellipse(ctx, xx, yb - h / 2, 9, h * 0.3); ctx.fill();
        ctx.fillStyle = '#ffe08a';
        for (const s of [-4, 0, 4]) { ellipse(ctx, xx + s, yb - h / 2, 1.2, 0.8); ctx.fill(); }
      }
      break;
    }
    default:
      break;
  }
}

export function drawPlate(ctx, cx, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ellipse(ctx, cx, y + 9, w / 2 + 4, 6); ctx.fill();
  ctx.fillStyle = vgrad(ctx, y - 4, y + 8, ['#ffffff', '#dfe5f2', '#aab4c8']);
  ellipse(ctx, cx, y + 3, w / 2, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,140,180,0.6)';
  ctx.lineWidth = 1;
  ellipse(ctx, cx, y + 2, w / 2 - 10, 4); ctx.stroke();
}

export function drawShaker(ctx, x, y, s = 1, glow = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (glow) {
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 12 * glow;
  }
  ctx.fillStyle = vgrad(ctx, -18, 0, ['#f4f7ff', '#c4cbe0']);
  roundRect(ctx, -6, -16, 12, 16, 3); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2a2a2a';
  roundRect(ctx, -4.5, -10, 9, 8, 2); ctx.fill();
  ctx.fillStyle = vgrad(ctx, -22, -15, ['#d0d6e4', '#7c869c']);
  roundRect(ctx, -6.5, -21, 13, 6, 3); ctx.fill();
  ctx.fillStyle = '#333';
  for (const hx of [-3, 0, 3]) { ellipse(ctx, hx, -18.5, 0.8, 0.8); ctx.fill(); }
  ctx.restore();
}

export function drawHat(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-7, -6, 14, 6);
  ctx.beginPath();
  ctx.arc(-4, -9, 5, 0, TAU);
  ctx.arc(4, -9, 5, 0, TAU);
  ctx.arc(0, -13, 5.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Stick figure for the "how to play" cards. pose: arm | hands | squat | pepper
export function drawStickFigure(ctx, cx, cy, pose, t, color = '#ffffff') {
  const ph = (Math.sin(t * 3) + 1) / 2;
  let dx = 0;
  let dy = 0;
  let arms = 'down';
  let knees = 0;
  // which way the arm(s) point: -1 left, 1 right (alternates every ~2 s)
  const side = Math.sin(t * 1.5) > 0 ? 1 : -1;
  if (pose === 'arm') arms = ph > 0.25 ? 'out' : 'down';
  if (pose === 'hands') arms = ph > 0.3 ? 'up' : 'down';
  if (pose === 'squat') { knees = ph; dy = ph * 14; }
  if (pose === 'pepper') arms = ph > 0.25 ? 'side' : 'down';
  const x = cx + dx;
  const hip = cy + dy;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // legs
  const footY = cy + 26;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, hip);
    ctx.lineTo(x + s * (5 + knees * 10), hip + 13 - knees * 6);
    ctx.lineTo(x + s * 6, footY);
    ctx.stroke();
  }
  // body
  ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x, hip - 24); ctx.stroke();
  // arms
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, hip - 20);
    if (arms === 'up') ctx.lineTo(x + s * 9, hip - 46);
    else if (arms === 'out' && s === side) ctx.lineTo(x + s * 30, hip - 22);
    else if (arms === 'side') ctx.lineTo(x + side * (s === side ? 30 : 22), hip - 20);
    else ctx.lineTo(x + s * 11, hip - 4);
    ctx.stroke();
  }
  // head
  ctx.beginPath(); ctx.arc(x, hip - 32, 6.5, 0, TAU); ctx.stroke();
  // floor
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 34, cy + 28); ctx.lineTo(cx + 34, cy + 28); ctx.stroke();
}
