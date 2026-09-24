/**
 * Endless mode.
 *
 * The normal modes end at the halo, which caps the reachable score and makes
 * the high-score table converge. Here, clouds that scroll off the bottom are
 * recycled to the top instead, and the hazard mix ramps up with altitude.
 */
const Endless = {
  enabled: false,

  // Vertical gap between a recycled cloud and the current highest one.
  GAP_MIN: 60,
  GAP_MAX: 95,

  // Altitude at which the difficulty ramp reaches its maximum.
  RAMP_HEIGHT: 6000,

  // How far below the canvas a cloud must fall before it is reused.
  RECYCLE_MARGIN: 150,

  reset() {
    // No cross-run state yet; kept so callers need not know that.
  },

  /** Difficulty ramp, 0 to 1, driven by altitude. */
  progress() {
    return Math.min(1, Score.maxHeight / this.RAMP_HEIGHT);
  },

  /** Moves off-screen clouds back to the top. clouds and objects stay index-aligned. */
  recycle() {
    if (!this.enabled || clouds.length === 0) {
      return;
    }

    let topY = Infinity;
    for (const c of clouds) {
      if (c.y < topY) topY = c.y;
    }

    for (let i = 0; i < clouds.length; i++) {
      if (clouds[i].y <= canvasHeight + this.RECYCLE_MARGIN) {
        continue;
      }
      topY -= random(this.GAP_MIN, this.GAP_MAX);
      clouds[i] = this.spawnCloud(topY);
      objects[i] = this.spawnObject(clouds[i]);
    }
  },

  spawnCloud(y) {
    const p = this.progress();
    const x = random(cloudWidth, canvasWidth - cloudWidth);

    if (random() < 0.30 + 0.25 * p) {
      return new MovingCloud(x, y);
    }
    const roll = random();
    if (roll < 0.10) return new SpringCloud(x, y);
    if (roll < 0.10 + 0.20 * p) return new VanishingCloud(x, y);
    if (roll < 0.10 + 0.32 * p) return new FallingCloud(x, y);
    return new Cloud(x, y);
  },

  spawnObject(cloud) {
    // Unstable clouds carry nothing, or the item would be left hanging in mid-air.
    if (!canHoldItem(cloud)) {
      return new Objects(cloud);
    }
    const p = this.progress();
    const roll = random();
    if (roll < 0.25) return new Candy(cloud);
    if (roll < 0.25 + 0.18 * p) return new Monster(cloud);
    if (roll < 0.25 + 0.36 * p) return new Danger(cloud);
    return new Objects(cloud);
  },
};
