/**
 * Fades out shortly after being landed on and can then no longer be used.
 *
 * It is drawn translucent before being touched too, so a route can be read in
 * advance rather than only discovered by falling through.
 */
class VanishingCloud extends Cloud {
  constructor(x, y) {
    super(x, y);
    this.fadeFrames = 30;
    this.remaining = this.fadeFrames;
    this.touched = false;
  }

  onLanded() {
    this.touched = true;
  }

  isSolid() {
    return this.remaining > 0;
  }

  move() {
    if (this.touched && this.remaining > 0) {
      this.remaining--;
    }
  }

  show() {
    if (this.remaining <= 0) {
      return;
    }
    const progress = this.touched ? this.remaining / this.fadeFrames : 1;
    push();
    tint(230, 200, 255, 60 + 135 * progress);
    image(cloudImg, this.x - this.w / 2, this.y - this.h / 2, this.w, this.spriteHeight());
    pop();
  }
}
