// ---------------------------------------------------------------------------
// Enemy: moves from graph node to graph node. At each node it picks the
// neighbour that is closest to the chef according to the shared distance
// field, with a bit of randomness ("wander") so enemies don't stack.
// ---------------------------------------------------------------------------

const PERSONALITY = {
  onion: { wander: 0.22, speed: 1.0 },     // rolls around, a bit erratic
  chili: { wander: 0.1, speed: 1.08 },     // fast and focused
  meatball: { wander: 0.05, speed: 0.92 }, // slow but relentless
};

export class Enemy {
  constructor(kind, node, speed) {
    this.kind = kind;
    const p = PERSONALITY[kind] ?? PERSONALITY.onion;
    this.wander = p.wander;
    this.speed = speed * p.speed;
    this.node = node;
    this.prevNode = null;
    this.next = null;
    this.x = node.x;
    this.y = node.y;
    this.facing = 1;
    this.state = 'spawn';   // spawn | walk | stunned | riding | squashed | gone
    this.stateT = 0;
    this.stunT = 0;
    this.ridingOn = null;
    this.anim = Math.random() * 10;
  }

  get dangerous() { return this.state === 'walk'; }
  get stunnable() { return this.state === 'walk' || this.state === 'stunned'; }
  get squashable() { return this.state === 'walk' || this.state === 'stunned' || this.state === 'spawn'; }
  get climbing() { return !!this.next && Math.abs(this.next.y - this.node.y) > 1; }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  update(dt, game) {
    this.anim += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'spawn':
        if (this.stateT > 0.7) this.setState('walk');
        break;
      case 'stunned':
        this.stunT -= dt;
        if (this.stunT <= 0) this.setState('walk');
        break;
      case 'riding':
        this.y = this.ridingOn.y - this.ridingOn.h;
        break;
      case 'squashed':
        if (this.stateT > 0.8) this.setState('gone');
        break;
      case 'walk':
        this.move(dt, game);
        break;
    }
  }

  move(dt, game) {
    let budget = this.speed * dt;
    let guard = 4;
    while (budget > 0 && guard-- > 0) {
      if (!this.next) {
        this.next = this.chooseNext(game);
        if (!this.next) return;
      }
      const dx = this.next.x - this.x;
      const dy = this.next.y - this.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) this.facing = Math.sign(dx);
      if (d <= budget) {
        this.x = this.next.x;
        this.y = this.next.y;
        budget -= d;
        this.prevNode = this.node;
        this.node = this.next;
        this.next = null;
      } else {
        this.x += (dx / d) * budget;
        this.y += (dy / d) * budget;
        budget = 0;
      }
    }
  }

  chooseNext(game) {
    const options = this.node.edges.map((e) => e.to);
    if (!options.length) return null;
    const field = game.distField;
    if (!field || game.rng() < this.wander) {
      const fresh = options.filter((n) => n !== this.prevNode);
      const pool = fresh.length ? fresh : options;
      return pool[Math.floor(game.rng() * pool.length)];
    }
    let best = null;
    let bestScore = Infinity;
    for (const n of options) {
      const score = (field.get(n.key) ?? 999) + (n === this.prevNode ? 1.5 : 0) + game.rng() * 0.4;
      if (score < bestScore) { best = n; bestScore = score; }
    }
    return best;
  }

  stun(t) {
    if (!this.stunnable) return false;
    const fresh = this.state === 'walk';
    this.setState('stunned');
    this.stunT = t;
    return fresh;
  }

  ride(ingredient) {
    this.setState('riding');
    this.ridingOn = ingredient;
    this.next = null;
  }

  squash() {
    this.setState('squashed');
  }
}
