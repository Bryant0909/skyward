/** One life indicator in the status bar. */
class LifeHeart {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
  }

  /** status: 1 for a remaining life, 0 for a lost one. */
  show(status) {
    if (status === 1) {
      tint(255, 255);
    } else {
      tint(255, 0);
    }
    image(heartImg, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}
