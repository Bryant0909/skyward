/**
 * On-screen buttons for touch devices.
 *
 * Positions use the fixed 800x600 coordinate space. The canvas is scaled by
 * CSS and p5 converts pointer coordinates back, so the buttons scale with
 * everything else without knowing the display size.
 *
 * Keyboard input is not replaced; drawGame() combines both sources.
 */
const TouchControls = {
  BUTTONS: {
    left:  { x: 72,  y: 528, r: 38 },
    right: { x: 170, y: 528, r: 38 },
    jump:  { x: 718, y: 522, r: 50 }
  },

  enabled: false,

  /** Enabled on phones, tablets and touch laptops; hidden for mouse-only setups. */
  detect() {
    this.enabled = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
                   ('ontouchstart' in window);
    return this.enabled;
  },

  /** Which button a point falls on, or null. */
  at(px, py) {
    if (!this.enabled) {
      return null;
    }
    for (const name of Object.keys(this.BUTTONS)) {
      const b = this.BUTTONS[name];
      if (dist(px, py, b.x, b.y) <= b.r) {
        return name;
      }
    }
    return null;
  },

  /** Held state, needed because movement is continuous rather than per-press. */
  isHeld(name) {
    if (!this.enabled) {
      return false;
    }
    for (const t of touches) {
      if (this.at(t.x, t.y) === name) {
        return true;
      }
    }
    return false;
  },

  draw() {
    if (!this.enabled) {
      return;
    }
    push();
    noStroke();

    this._drawButton(this.BUTTONS.left, this.isHeld('left'));
    this._drawArrow(this.BUTTONS.left, -1);

    this._drawButton(this.BUTTONS.right, this.isHeld('right'));
    this._drawArrow(this.BUTTONS.right, 1);

    this._drawButton(this.BUTTONS.jump, this.isHeld('jump'));
    fill(255, 235);
    textAlign(CENTER, CENTER);
    textSize(18);
    text('JUMP', this.BUTTONS.jump.x, this.BUTTONS.jump.y);

    pop();
  },

  _drawButton(b, held) {
    fill(255, held ? 150 : 90);
    circle(b.x, b.y, b.r * 2);
    fill(0, held ? 60 : 30);
    circle(b.x, b.y, b.r * 2 - 8);
  },

  _drawArrow(b, dir) {
    const s = b.r * 0.42;
    fill(255, 235);
    triangle(
      b.x + dir * s, b.y,
      b.x - dir * s * 0.6, b.y - s,
      b.x - dir * s * 0.6, b.y + s
    );
  }
};
