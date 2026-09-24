/** The ground at the bottom of the level. Landing on it costs a life. */
class Plateform {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = canvasWidth;
    this.h = grassHeight;
  }

  move() {}

  show() {
    image(grassImg, this.x - this.w / 2, this.y - this.h, this.w, this.h);
  }
}
