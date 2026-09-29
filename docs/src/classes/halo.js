/** Sits on the final cloud. Touching it wins the run. */
class Halo extends Objects {
  constructor(cloud) {
    super(cloud);
  }

  move() {
    super.move();
  }

  show() {
    image(haloImg, this.x, this.y, this.size, this.size);
  }
}
