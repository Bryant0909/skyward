/** Collecting three grants an extra life. */
class Candy extends Objects {
  constructor(cloud) {
    super(cloud);
    this.size = 50;
    // The candy art is larger than other objects and needs an offset to look
    // like it is resting on the cloud. bounds() picks this up, so the hitbox
    // follows the sprite.
    this.drawOffsetY = 20;
  }

  move() {
    super.move();
  }

  show() {
    image(candyImg, this.x, this.y + this.drawOffsetY, this.size, this.size);
  }
}
