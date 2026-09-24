/**
 * Starts falling the moment it is landed on, carrying the player down with it.
 *
 * Unlike a vanishing cloud it remains usable while it drops, so it doubles as a
 * way to descend deliberately.
 */
class FallingCloud extends Cloud {
  constructor(x, y) {
    super(x, y);
    this.falling = false;
    this.fallVelocity = 0;
    this.fallGravity = 0.35;
  }

  onLanded() {
    this.falling = true;
  }

  isSolid() {
    return this.y < canvasHeight + 100;
  }

  move() {
    if (!this.falling) {
      return;
    }
    this.fallVelocity += this.fallGravity;
    this.y += this.fallVelocity;
  }

  show() {
    if (!this.isSolid()) {
      return;
    }
    push();
    tint(255, 200, 160);
    image(cloudImg, this.x - this.w / 2, this.y - this.h / 2, this.w, this.spriteHeight());
    noTint();

    // Crack marks, placed on the body rather than the landing surface.
    fill(200, 120, 60);
    noStroke();
    const dotY = this.y - this.h / 2 + this.spriteHeight() * 0.45;
    for (let i = -1; i <= 1; i++) {
      circle(this.x + i * 14, dotY, 4);
    }
    pop();
  }
}
