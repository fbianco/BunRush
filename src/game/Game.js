// ---------------------------------------------------------------------------
// Game: the rules. Owns the level, the actors and the score, and runs the
// per-level state machine:
//
//    ready --2s--> playing --caught--> dying --> ready (or gameover)
//                     \--all burgers done--> clear --> next level
//
// It never touches the DOM: sound and particle effects are injected, so the
// whole game can run headless in Node for automated tests.
// ---------------------------------------------------------------------------
import {
  TILE, INGREDIENT_W, PLATE_Y, GRAVITY, MAX_FALL_SPEED, PEPPER_DURATION, STUN_TIME,
  START_LIVES, START_PEPPER, ENEMY_BASE_SPEED, ENEMY_SPEED_PER_LEVEL,
  restY, surfaceY,
} from '../config.js';
import { LEVELS } from './levels.js';
import { Level } from './Level.js';
import { NavGraph } from './NavGraph.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { Ingredient } from './Ingredient.js';

const noop = () => {};
const NO_SOUND = { play: noop, startMusic: noop, stopMusic: noop };
const NO_FX = { burst: noop, text: noop, puff: noop, sparkle: noop, update: noop, clear: noop };

export class Game {
  constructor({ sound = NO_SOUND, fx = NO_FX, storage = null, rng = Math.random } = {}) {
    this.sound = sound;
    this.fx = fx;
    this.storage = storage;
    this.rng = rng;
    this.hiScore = Number(storage?.get('bunrush.hiscore') ?? 0) || 0;
    this.state = 'idle';
    this.stateTime = 0;
    this.time = 0;
    this.levelVersion = 0;
    this.shake = 0;
    this.score = 0;
  }

  // ---- setup ---------------------------------------------------------------
  newGame() {
    this.score = 0;
    this.lives = START_LIVES;
    this.pepper = START_PEPPER;
    this.loadLevel(0);
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.loop = Math.floor(index / LEVELS.length);
    const def = LEVELS[index % LEVELS.length];
    this.def = def;
    this.level = new Level(def);
    this.nav = new NavGraph(this.level);
    this.ingredients = [];
    this.plates = def.burgers.map((b, i) => ({
      burger: i, col: b.col, x: b.col * TILE + INGREDIENT_W / 2, y: PLATE_Y,
      stackHeight: 0, count: 0, total: b.items.length,
    }));
    def.burgers.forEach((b, i) => {
      for (const [kind, row] of b.items) this.ingredients.push(new Ingredient(kind, b.col, row, i));
    });
    this.enemySpeed = ENEMY_BASE_SPEED + ENEMY_SPEED_PER_LEVEL * index;
    this.enemyKinds = [...def.enemies];
    for (let i = 0; i < this.loop; i++) this.enemyKinds.push(['meatball', 'chili', 'onion'][i % 3]);
    this.levelVersion++;
    this.drops = 0;
    this.fx.clear();
    this.resetActors();
    this.setState('ready');
  }

  resetActors() {
    this.player = new Player(this.level, this.def.playerStart);
    this.enemies = [];
    this.spawnQueue = this.enemyKinds.map((kind, i) => ({ kind, t: 1.2 + i * 2.6 }));
    this.clouds = [];
    this.pickup = null;
    this.distField = null;
    this.navTimer = 0;
    this.invulnerable = 1.0;
    this.pepperCooldown = 0;
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    if (s === 'playing') this.sound.startMusic();
    if (s === 'dying' || s === 'gameover' || s === 'clear') this.sound.stopMusic();
    if (s === 'ready') this.sound.play('ready');
  }

  addScore(points, x, y) {
    this.score += points;
    if (x !== undefined) this.fx.text(x, y, String(points));
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
    }
  }

  saveHiScore() {
    try { this.storage?.set('bunrush.hiscore', String(this.hiScore)); } catch { /* ignore */ }
  }

  // ---- main update ---------------------------------------------------------
  update(dt, intent) {
    this.time += dt;
    this.stateTime += dt;
    this.shake = Math.max(0, this.shake - dt * 4);
    this.fx.update(dt);
    for (const ing of this.ingredients ?? []) ing.bounce = Math.max(0, ing.bounce - dt * 4);

    switch (this.state) {
      case 'ready':
        if (this.stateTime > 2) this.setState('playing');
        break;
      case 'playing':
        this.updatePlaying(dt, intent);
        break;
      case 'dying':
        if (this.stateTime > 2.4) {
          this.lives--;
          if (this.lives <= 0) {
            this.saveHiScore();
            this.setState('gameover');
            this.sound.play('gameover');
          } else {
            this.resetActors();
            this.setState('ready');
          }
        }
        break;
      case 'clear':
        if (this.stateTime > 3.4) {
          this.pepper++;
          this.loadLevel(this.levelIndex + 1);
        }
        break;
      default:
        break;
    }
  }

  updatePlaying(dt, intent) {
    const p = this.player;
    p.update(dt, intent);
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    this.handlePepper(dt, intent);
    this.handleStepping();
    for (const ing of this.ingredients) if (ing.state === 'falling') this.updateFalling(ing, dt);
    this.updateClouds(dt);

    // enemy brains: one shortest-path search, shared by every enemy
    this.navTimer -= dt;
    if (this.navTimer <= 0) {
      this.navTimer = 0.2;
      this.distField = this.nav.distanceField(this.playerNode());
    }
    for (const e of this.enemies) e.update(dt, this);
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');

    this.updateSpawns(dt);
    this.updatePickup(dt);

    // caught?
    if (this.invulnerable <= 0) {
      for (const e of this.enemies) {
        if (e.dangerous && Math.abs(e.x - p.x) < 18 && Math.abs(e.y - p.y) < 22) {
          this.setState('dying');
          this.sound.play('die');
          this.shake = 0.6;
          return;
        }
      }
    }

    if (this.ingredients.every((i) => i.state === 'plated')) {
      const bonus = 1000 * (this.levelIndex + 1);
      this.addScore(bonus);
      this.saveHiScore();
      this.setState('clear');
      this.sound.play('clear');
    }
  }

  handlePepper(dt, intent) {
    const p = this.player;
    this.pepperCooldown -= dt;
    if (!intent.pepper || this.pepperCooldown > 0) return;
    if (this.pepper <= 0) {
      this.sound.play('empty');
      this.pepperCooldown = 0.4;
      return;
    }
    this.pepper--;
    this.pepperCooldown = 0.35;
    p.aimPepper(intent.pepperDir);
    p.pepperAnim = 0.45;
    let cloud;
    if (p.onLadder) {
      const dir = p.climbDir || -1;
      cloud = { x: p.x, y: p.y - 18 + dir * 40, vx: 0, vy: dir * 30, t: 0 };
    } else {
      cloud = { x: p.x + p.facing * 34, y: p.y - 18, vx: p.facing * 50, vy: 0, t: 0 };
    }
    this.clouds.push(cloud);
    this.fx.puff(cloud.x, cloud.y, p.onLadder ? 0 : p.facing);
    this.sound.play('pepper');
  }

  handleStepping() {
    const p = this.player;
    if (p.onLadder) return;
    const row = p.row;
    if (row === null) return;
    for (const ing of this.ingredients) {
      if (ing.state !== 'rest' || ing.row !== row) continue;
      const seg = Math.floor((p.x - ing.x0) / TILE);
      if (seg < 0 || seg > 3 || ing.pressed[seg]) continue;
      ing.pressed[seg] = true;
      this.addScore(10);
      this.sound.play('step');
      if (ing.allPressed) {
        this.drops++;
        this.dropIngredient(ing);
        if (this.drops % 4 === 0) this.spawnPickup();
      }
    }
  }

  /** Start an ingredient falling; enemies standing on it ride along. */
  dropIngredient(ing, speed) {
    ing.startFall(this.level, speed);
    this.sound.play('drop');
    const top = surfaceY(ing.row);
    for (const e of this.enemies) {
      if ((e.state === 'walk' || e.state === 'stunned') && Math.abs(e.y - top) < 1 &&
          e.x >= ing.x0 && e.x <= ing.x0 + INGREDIENT_W) {
        e.ride(ing);
      }
    }
  }

  updateFalling(ing, dt) {
    const prevTop = ing.y - ing.h;
    ing.vy = Math.min(ing.vy + GRAVITY * dt, MAX_FALL_SPEED);
    ing.y += ing.vy * dt;

    // squash enemies under the falling layer
    for (const e of this.enemies) {
      if (!e.squashable || e.ridingOn === ing) continue;
      if (e.x > ing.x0 - 6 && e.x < ing.x0 + INGREDIENT_W + 6 && ing.y >= e.y - 30 && prevTop <= e.y) {
        e.squash();
        this.addScore(200, e.x, e.y - 30);
        this.fx.burst(e.x, e.y - 14, { colors: ['#ffe066', '#ff6b6b', '#ffffff'], count: 18 });
        this.sound.play('squash');
        this.queueRespawn(e.kind);
      }
    }

    if (ing.target.type === 'floor') {
      const ty = restY(ing.target.row);
      // knock the layer that is sitting where we will land
      const occ = this.ingredients.find((o) => o !== ing && o.burger === ing.burger &&
        o.state === 'rest' && o.row === ing.target.row);
      if (occ && ing.kicked !== occ && ing.y >= ty - occ.h) {
        ing.kicked = occ;
        this.dropIngredient(occ, ing.vy);
      }
      if (ing.y >= ty) this.land(ing, ty, null);
    } else {
      const plate = this.plates[ing.burger];
      const ty = plate.y - plate.stackHeight;
      if (ing.y >= ty) this.land(ing, ty, plate);
    }
  }

  land(ing, y, plate) {
    ing.y = y;
    ing.vy = 0;
    ing.bounce = 1;
    ing.pressed = [false, false, false, false];
    const cx = ing.x0 + INGREDIENT_W / 2;
    if (plate) {
      ing.state = 'plated';
      plate.stackHeight += ing.h;
      plate.count++;
      this.addScore(50);
      this.sound.play('plate');
      this.fx.sparkle(cx, y - ing.h);
      if (plate.count === plate.total) {
        this.fx.text(cx, y - ing.h - 20, 'ORDER UP!', '#7CFFB2');
        this.sound.play('burger');
      }
    } else {
      ing.state = 'rest';
      ing.row = ing.target.row;
      this.addScore(50);
      this.sound.play('land');
      this.fx.burst(cx, y, { colors: ['#f2c27a', '#c98b3c', '#ffffff'], count: 14, speed: 90, gravity: 500 });
    }
    this.shake = Math.max(this.shake, 0.25);

    // enemies that rode down: big bonus, doubled for each extra rider
    const riders = this.enemies.filter((e) => e.ridingOn === ing);
    riders.forEach((e, i) => {
      e.squash();
      e.ridingOn = null;
      this.addScore(500 * 2 ** i, e.x, e.y - 30 - i * 14);
      this.queueRespawn(e.kind);
    });
    if (riders.length) this.sound.play('squash');
  }

  updateClouds(dt) {
    for (const c of this.clouds) {
      c.t += dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      for (const e of this.enemies) {
        if (Math.abs(e.x - c.x) < 34 && Math.abs(e.y - 16 - c.y) < 32 && e.stun(STUN_TIME)) {
          this.addScore(100, e.x, e.y - 34);
          this.sound.play('stun');
        }
      }
    }
    this.clouds = this.clouds.filter((c) => c.t < PEPPER_DURATION);
  }

  queueRespawn(kind) {
    this.spawnQueue.push({ kind, t: 3.5 });
  }

  updateSpawns(dt) {
    for (const s of this.spawnQueue) s.t -= dt;
    const ready = this.spawnQueue.filter((s) => s.t <= 0);
    this.spawnQueue = this.spawnQueue.filter((s) => s.t > 0);
    for (const s of ready) {
      // spawn at the entry point farthest from the chef
      const p = this.player;
      let best = null;
      let bestD = -1;
      for (const [r, c] of this.def.spawns) {
        const n = this.nav.get(r, c);
        if (!n) continue;
        const d = Math.abs(n.x - p.x) + Math.abs(n.y - p.y) * 2;
        if (d > bestD) { best = n; bestD = d; }
      }
      if (best) {
        this.enemies.push(new Enemy(s.kind, best, this.enemySpeed));
        this.fx.burst(best.x, best.y - 14, { colors: ['#b48cff', '#ffffff'], count: 10, speed: 60, gravity: 0 });
      }
    }
  }

  spawnPickup() {
    // a pepper refill appears on a free floor tile near the middle
    const candidates = this.nav.list.filter((n) =>
      n.c > 4 && n.c < 23 &&
      !this.level.ladders.some((l) => l.col === n.c) &&
      !this.ingredients.some((i) => i.state === 'rest' && i.row === n.r && n.c >= i.col && n.c < i.col + 4));
    if (!candidates.length) return;
    const n = candidates[Math.floor(this.rng() * candidates.length)];
    this.pickup = { x: n.x, y: n.y, t: 0 };
    this.sound.play('bonus');
  }

  updatePickup(dt) {
    const k = this.pickup;
    if (!k) return;
    k.t += dt;
    if (k.t > 10) { this.pickup = null; return; }
    const p = this.player;
    if (Math.abs(p.x - k.x) < 18 && Math.abs(p.y - k.y) < 10) {
      this.pepper++;
      this.addScore(500, k.x, k.y - 30);
      this.sound.play('pickup');
      this.fx.sparkle(k.x, k.y - 12);
      this.pickup = null;
    }
  }

  /** Graph node that best represents the chef (a ladder stop when climbing). */
  playerNode() {
    const p = this.player;
    if (p.ladder) {
      let best = null;
      for (const r of this.level.ladderStops(p.ladder)) {
        const n = this.nav.get(r, p.ladder.col);
        if (!best || Math.abs(n.y - p.y) < Math.abs(best.y - p.y)) best = n;
      }
      if (best) return best;
    }
    return this.nav.nearest(p.x, p.y);
  }

  /** Visual offset so characters appear to walk on top of ingredients. */
  standOffset(x, y) {
    for (const ing of this.ingredients) {
      if (ing.state === 'rest' && Math.abs(surfaceY(ing.row) - y) < 1 &&
          x >= ing.x0 && x <= ing.x0 + INGREDIENT_W) {
        const seg = Math.min(3, Math.max(0, Math.floor((x - ing.x0) / TILE)));
        return -(ing.h * 0.55) + (ing.pressed[seg] ? 4 : 0);
      }
    }
    return 0;
  }

  get levelNumber() {
    return this.levelIndex + 1;
  }
}
