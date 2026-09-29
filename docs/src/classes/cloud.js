// Sprite scale relative to the source image's natural aspect ratio.
// Drawing a cloud at its full natural height overlaps the level above, so it
// is pulled in slightly. The collision box is unaffected.
const CLOUD_SPRITE_SCALE = 0.72;

/** A static platform, and the base class for every cloud variant. */
class Cloud {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = cloudWidth;
    this.h = cloudHeight;
  }

  move() {}

  /** False once the cloud can no longer be landed on. */
  isSolid() {
    return true;
  }

  /** Called when the player lands; variants use it to trigger their effect. */
  onLanded() {}

  /** Jump power multiplier applied when jumping from this cloud. */
  jumpMultiplier() {
    return 1;
  }

  /**
   * Drawn height, derived from the source image's aspect ratio. Drawing at the
   * collision height instead would squash the image about 2.7x. The sprite's
   * top stays aligned with the collision box, so the player still stands in the
   * same place; the cloud simply gains its proper thickness below that line.
   */
  spriteHeight() {
    if (!cloudImg || !cloudImg.width) {
      return this.h;
    }
    return this.w * (cloudImg.height / cloudImg.width) * CLOUD_SPRITE_SCALE;
  }

  show() {
    image(cloudImg, this.x - this.w / 2, this.y - this.h / 2, this.w, this.spriteHeight());
  }
}
