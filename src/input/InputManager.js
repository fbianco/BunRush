// ---------------------------------------------------------------------------
// InputManager: merges keyboard and body control into one "intent".
// The game only ever sees { x, y, pepper, pepperDir, auto } - it does not
// know whether you pressed a key or waved your arms in front of the camera.
//
// `auto` tells the chef how to read x / y:
//   keyboard (auto = false): classic "move while the key is held"
//   body     (auto = true) : a gesture is a command - the chef keeps walking
//                            to the next ladder by himself, so the camera lag
//                            and slow arm movements do not matter
//
// Pepper is an *event*: the camera may produce it between two game ticks, so
// we latch it here and hand it out exactly once.
// ---------------------------------------------------------------------------
export class InputManager {
  constructor(keyboard, gestures) {
    this.keyboard = keyboard;
    this.gestures = gestures;
    this.bodyEnabled = false;
    this.pepperLatch = 0;   // 0 = none, else the direction (-1 / +1)
  }

  /** Called whenever the gesture interpreter produced a new frame. */
  onGestureFrame(out) {
    if (this.bodyEnabled && out.pepper) this.pepperLatch = out.pepperDir || 1;
  }

  /** Called once per game tick. */
  intent() {
    const k = this.keyboard;
    const kx = k.x;
    const ky = k.y;
    const keys = kx !== 0 || ky !== 0;
    const body = this.bodyEnabled && !keys;
    const g = body ? this.gestures.out : { x: 0, y: 0 };
    const space = k.consume('Space');
    const pepperDir = space ? 0 : this.pepperLatch;
    const pepper = space || this.pepperLatch !== 0;
    this.pepperLatch = 0;
    return {
      x: keys ? kx : g.x || 0,
      y: keys ? ky : g.y || 0,
      auto: body,
      pepper,
      pepperDir,
    };
  }
}
