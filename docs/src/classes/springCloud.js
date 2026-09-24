/**
 * Jumping from this cloud goes higher.
 *
 * The boost applies when the player chooses to jump rather than bouncing on
 * contact, which keeps the game's manual-jump design intact.
 */
class SpringCloud extends Cloud {
  constructor(x, y) {
    super(x, y);
    this.boost = 1.5;
  }

  jumpMultiplier() {
    return this.boost;
  }

  show() {
    push();
    tint(140, 255, 215);
    image(cloudImg, this.x - this.w / 2, this.y - this.h / 2, this.w, this.spriteHeight());
    noTint();

    // Arrow marker, so the cloud reads as different before it is stepped on.
    fill(20, 150, 110);
    noStroke();
    triangle(
      this.x, this.y - this.h,
      this.x - 7, this.y - this.h * 0.3,
      this.x + 7, this.y - this.h * 0.3
    );
    pop();
  }
}
