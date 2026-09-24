/** A ghost that patrols back and forth along its cloud. */
class Monster extends Danger {
  constructor(cloud) {
    super(cloud);
    this.speed = 2;
    this.direction = 1;
    this.size = 40;

    this.updateBounds();
    this.x = (this.minX + this.maxX) / 2;
  }

  /** Recomputed every frame so the patrol range follows a moving cloud. */
  updateBounds() {
    this.minX = this.cloud.x - this.cloud.w / 2;
    this.maxX = this.cloud.x + this.cloud.w / 2 - this.size;
    this.y = this.cloud.y - this.cloud.h / 2 - this.size;
  }

  move() {
    this.updateBounds();
    this.x += this.speed * this.direction;

    if (this.x <= this.minX) {
      this.x = this.minX;
      this.direction *= -1;
    }
    if (this.x >= this.maxX) {
      this.x = this.maxX;
      this.direction *= -1;
    }
  }

  show() {
    if (this.direction === -1) {
      image(monsterLeftImg, this.x, this.y, this.size, this.size);
    } else {
      image(monsterRightImg, this.x, this.y, this.size, this.size);
    }
  }
}
