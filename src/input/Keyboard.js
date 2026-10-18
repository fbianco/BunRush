// Keyboard: held keys for movement + one-shot "pressed" events for actions.
const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export class Keyboard {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    target.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  axis(neg, pos) {
    const n = neg.some((k) => this.down.has(k));
    const p = pos.some((k) => this.down.has(k));
    return (p ? 1 : 0) - (n ? 1 : 0);
  }

  get x() { return this.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']); }
  get y() { return this.axis(['ArrowUp', 'KeyW'], ['ArrowDown', 'KeyS']); }

  /** True once per key press. */
  consume(code) {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }

  clearPressed() {
    this.pressed.clear();
  }
}
