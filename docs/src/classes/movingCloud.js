/** A cloud that drifts horizontally between two bounds. */
class MovingCloud extends Cloud {
  constructor(x, y) {
    super(x, y);
    this.speed = random(0.5, 1.5) * difficultyConfig().movingSpeed;
    this.direction = random([-1, 1]);
    this.lastDelta = 0;

    this.maxX = (x + this.w / 2 + movingDistance) > canvasWidth ? canvasWidth - this.w / 2 : x + movingDistance;
    this.minX = (x - this.w / 2 - movingDistance) < 0 ? this.w / 2 : x - movingDistance;
  }

  move() {
    const before = this.x;
    this.x += this.speed * this.direction;
    if (this.x <= this.minX || this.x >= this.maxX) {
      this.direction *= -1;
    }
    // Distance travelled this frame. Player adds it to its own position so that
    // being carried by the cloud composes with the player's own momentum.
    this.lastDelta = this.x - before;
  }

  show() {
    super.show();
  }
}
