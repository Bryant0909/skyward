/** Hellfire. Costs a life on contact. Base class for Monster. */
class Danger extends Objects {
  constructor(cloud) {
    super(cloud);
    this.size = 25;
  }

  move() {
    super.move();
  }

  show() {
    image(dangerImg, this.x, this.y, this.size, this.size);
  }
}
