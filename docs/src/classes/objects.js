/** Base class for everything that sits on top of a cloud. */
class Objects {
  constructor(cloud) {
    this.size = 30;
    this.cloud = cloud;
    this.x = random(cloud.x - cloud.w / 2 + this.size * 2, cloud.x + cloud.w / 2 - this.size * 2);
    this.y = cloud.y - cloud.h / 2 - this.size;

    this.offsetX = this.x - cloud.x;

    // Vertical draw offset relative to this.y; overridden by Candy.
    this.drawOffsetY = 0;
  }

  /**
   * The rectangle the sprite actually occupies, matching show(). Collision
   * reads this so that what is visible is what can be hit.
   */
  bounds() {
    return {
      left: this.x,
      right: this.x + this.size,
      top: this.y + this.drawOffsetY,
      bottom: this.y + this.drawOffsetY + this.size
    };
  }

  move() {
    this.x = this.offsetX + this.cloud.x;
    this.y = this.cloud.y - this.cloud.h / 2 - this.size;
  }

  show() {}
}
