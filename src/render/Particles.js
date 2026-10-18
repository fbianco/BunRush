// ---------------------------------------------------------------------------
// Particles: crumbs, pepper clouds, sparkles and floating score text.
// The game calls fx.burst(...) etc. in level coordinates; the renderer draws.
// ---------------------------------------------------------------------------
import { FONT } from '../config.js';

export class Particles {
  constructor() {
    this.parts = [];
    this.texts = [];
  }

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
  }

  burst(x, y, { count = 12, colors = ['#fff'], speed = 120, life = 0.7, size = 3, gravity = 420 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.4,
        g: gravity, life: life * (0.6 + Math.random() * 0.6), t: 0,
        size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], kind: 'dot',
      });
    }
  }

  puff(x, y, dir) {
    for (let i = 0; i < 26; i++) {
      const spread = dir === 0 ? 1 : 0.6;
      this.parts.push({
        x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 16,
        vx: dir * (40 + Math.random() * 80) + (Math.random() - 0.5) * 60 * spread,
        vy: (Math.random() - 0.5) * 60 - 10,
        g: -20, life: 0.5 + Math.random() * 0.4, t: 0,
        size: 1.5 + Math.random() * 2.5,
        color: i % 3 ? '#2b2b2b' : '#8a8a8a', kind: 'dot',
      });
    }
    for (let i = 0; i < 6; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 18, y: y + (Math.random() - 0.5) * 12,
        vx: dir * 40, vy: -10, g: -10, life: 0.6, t: 0,
        size: 10 + Math.random() * 8, color: 'rgba(200,200,210,0.25)', kind: 'smoke',
      });
    }
  }

  sparkle(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.parts.push({
        x, y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 70 - 40, g: 120,
        life: 0.7, t: 0, size: 3, color: i % 2 ? '#fff27a' : '#7CFFB2', kind: 'star',
      });
    }
  }

  text(x, y, str, color = '#ffffff') {
    this.texts.push({ x, y, str, color, t: 0, life: 1.1 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const s of this.texts) { s.t += dt; s.y -= 28 * dt; }
    this.texts = this.texts.filter((s) => s.t < s.life);
  }

  draw(ctx) {
    for (const p of this.parts) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      if (p.kind === 'smoke') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.5 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'star') {
        ctx.fillRect(p.x - p.size, p.y - 0.6, p.size * 2, 1.2);
        ctx.fillRect(p.x - 0.6, p.y - p.size, 1.2, p.size * 2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = `10px ${FONT}`;
    for (const s of this.texts) {
      ctx.globalAlpha = Math.min(1, (1 - s.t / s.life) * 2);
      ctx.fillStyle = '#000';
      ctx.fillText(s.str, s.x + 1, s.y + 1);
      ctx.fillStyle = s.color;
      ctx.fillText(s.str, s.x, s.y);
    }
    ctx.globalAlpha = 1;
  }
}
