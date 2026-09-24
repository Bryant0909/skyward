// Horizontal movement feel. Keyboard input is binary, so acceleration and
// friction have to be added explicitly to avoid a snap-on/snap-off slide.
const MOVE_TUNING = {
  accel: 1.2,        // speed gained per frame while a direction is held
  maxSpeed: 5.5,     // horizontal speed cap
  friction: 0.80,    // fraction of speed kept per frame with no input
  airControl: 0.80,  // acceleration multiplier while airborne
  stopEpsilon: 0.05, // below this speed, snap to zero
  tiltRadians: 0.22, // sprite tilt at full speed (~12.6 degrees)
};

// Jump assists. Each one closes a gap between when the player thinks they
// pressed jump and when the game would otherwise accept it.
const JUMP_TUNING = {
  coyoteFrames: 6,     // grace period for jumping after leaving a platform
  bufferFrames: 8,     // how long an early jump press is remembered
  cutMultiplier: 0.65, // rise speed kept when the key is released early
};

class Player {
  constructor(x, y) {
    this.size = 40;
    this.x = x;
    this.pace = 5;
    this.y = y - this.size / 2;
    this.direction = 1;
    this.jumpPower = -15;
    this.gravity = 0.8;
    this.velocity = 0;
    this.prevY = this.y;

    this.currentCloud = null;
    this.isControlled = false;
    this.isJumping = false;
    this.isStart = true;

    this.coyoteFrames = 0;
    this.jumpBufferFrames = 0;
    this.jumpHeld = false;

    this.velocityX = 0;
    this.inputDir = 0;

    // Jump multiplier from the current footing. Stored rather than read at jump
    // time because coyote time allows jumping after currentCloud is already null.
    this.jumpMultiplier = 1;
  }

  /**
   * Registers the intent to jump. updateJumpAssist() decides whether it
   * actually happens, so a press made slightly too early is not discarded.
   */
  requestJump() {
    // Key auto-repeat would otherwise refill the buffer and turn a held key
    // into continuous bouncing.
    if (this.jumpHeld) {
      return;
    }
    this.jumpHeld = true;
    this.jumpBufferFrames = JUMP_TUNING.bufferFrames;
  }

  /** Releasing mid-rise cuts the ascent short, giving variable jump height. */
  releaseJump() {
    this.jumpHeld = false;
    if (this.velocity < 0) {
      this.velocity *= JUMP_TUNING.cutMultiplier;
    }
  }

  isGrounded() {
    return !!this.currentCloud ||
           this.y >= plateform.y - this.size / 2 - grassHeight - 0.5;
  }

  /**
   * Maintains coyote time and the jump buffer, and jumps when both allow it.
   * Called after landing checks so a buffered jump can fire on the landing frame.
   */
  updateJumpAssist() {
    const grounded = this.isGrounded();
    if (grounded) {
      this.coyoteFrames = JUMP_TUNING.coyoteFrames;
    }

    // Tested before decrementing, so coyoteFrames is the number of usable frames.
    // A negative velocity means the player is already rising.
    if (this.jumpBufferFrames > 0 && this.coyoteFrames > 0 && this.velocity >= 0) {
      this.jump();
      this.jumpBufferFrames = 0;
      this.coyoteFrames = 0;
      return;
    }

    if (this.jumpBufferFrames > 0) {
      this.jumpBufferFrames--;
    }
    if (!grounded && this.coyoteFrames > 0) {
      this.coyoteFrames--;
    }
  }

  update() {
    this.prevY = this.y;

    // Horizontal first, so the landing checks below see the current x.
    this.updateHorizontal();

    if (this.currentCloud && !this.isJumping) {
      const cloud = this.currentCloud;
      // Detach if the cloud is gone or the player has walked off its edge.
      if (!cloud.isSolid() ||
        this.x + this.size / 2 < cloud.x - cloud.w / 2 ||
        this.x + this.size / 2 > cloud.x + cloud.w / 2) {
        this.currentCloud = null;
      } else {
        // Carried along by a moving cloud, added to the player's own momentum.
        if (cloud instanceof MovingCloud) {
          this.x += cloud.lastDelta;
        }
        // Follow vertical movement too, so a falling cloud takes the player with it.
        this.y = cloud.y - cloud.h / 2 - this.size / 2;
        this.velocity = 0;
      }
    } else {
      this.y += this.velocity;
      this.velocity += this.gravity;
    }

    if (this.isJumping && this.velocity > 0) {
      this.isJumping = false;
    }

    // Landing. Swept against prevY so fast falls cannot pass through a cloud.
    if (!this.isJumping) {
      for (let cloud of clouds) {
        if (this.currentCloud) break;
        let cloudTop = cloud.y - cloud.h / 2;
        if (
          cloud.isSolid() &&
          this.velocity > 0 &&
          (this.prevY + this.size / 2) <= cloudTop &&
          (this.y + this.size / 2) >= cloudTop &&
          this.x + this.size / 2 >= cloud.x - cloud.w / 2 &&
          this.x + this.size / 2 <= cloud.x + cloud.w / 2
        ) {
          this.y = cloudTop - this.size / 2;
          this.velocity = 0;
          this.currentCloud = cloud;
          this.jumpMultiplier = cloud.jumpMultiplier();
          cloud.onLanded(this);
          scheduleCameraStep(this);
        }
      }
    }

    // Hitting the ground costs a life, except on the very first descent.
    if (this.y + this.size / 2 >= plateform.y - grassHeight) {
      this.y = plateform.y - this.size / 2 - grassHeight;
      this.velocity = 0;
      this.currentCloud = null;
      this.jumpMultiplier = 1;
      if (!this.isStart) {
        this.loseLife();
        this.isStart = true;
      }
    }

    // After landing checks, so a buffered jump can be consumed immediately.
    this.updateJumpAssist();

    this.isControlled = false;

    // Camera lives in sketch.js because it moves the world, not the player.
    updateCamera(this);
  }

  /** Records this frame's horizontal input; updateHorizontal() applies it. */
  move(dir) {
    this.direction = dir;
    this.inputDir = dir;
    this.isControlled = true;
  }

  /**
   * Accelerates toward the speed cap while a direction is held and coasts to a
   * stop otherwise. Acceleration is reduced in the air so ground control feels
   * firmer than air control.
   */
  updateHorizontal() {
    const t = MOVE_TUNING;
    const accel = t.accel * (this.isGrounded() ? 1 : t.airControl);

    if (this.inputDir !== 0) {
      this.velocityX += this.inputDir * accel;
      this.velocityX = max(-t.maxSpeed, min(t.maxSpeed, this.velocityX));
    } else {
      this.velocityX *= t.friction;
      if (abs(this.velocityX) < t.stopEpsilon) {
        this.velocityX = 0;
      }
    }

    this.x += this.velocityX;

    // Stop dead at the edges; keeping speed would stick the player to the wall.
    if (this.x < this.size / 2) {
      this.x = this.size / 2;
      this.velocityX = 0;
    } else if (this.x > canvasWidth - this.size / 2) {
      this.x = canvasWidth - this.size / 2;
      this.velocityX = 0;
    }

    this.inputDir = 0;
  }

  /** Callers do not check footing; updateJumpAssist() owns that decision. */
  jump() {
    this.isStart = false;
    this.velocity = this.jumpPower * this.jumpMultiplier;
    this.currentCloud = null;
    jumpSound.play();
  }

  addLife() {
    if (life < 3) {
      life += 1;
    }
  }

  loseLife() {
    life -= 1;
    triggerDamageFeedback();
    if (life <= 0) {
      gameScreen = "gameOver";
    }
  }

  /**
   * Swept collision: tests the path travelled between prevY and y rather than a
   * single instant. Falling speed reaches 15-25 px/frame, so an instant check
   * misses most objects on longer drops.
   */
  collidesWith(obj) {
    if (!(obj instanceof Objects)) {
      return false;
    }

    const box = obj.bounds();

    const sweptTop = min(this.prevY, this.y) - this.size / 2;
    const sweptBottom = max(this.prevY, this.y) + this.size / 2;
    if (sweptBottom < box.top || sweptTop > box.bottom) {
      return false;
    }

    // Both x values are sprite left edges, so compare centres.
    const playerCenterX = this.x + this.size / 2;
    const objCenterX = (box.left + box.right) / 2;
    return abs(playerCenterX - objCenterX) < (this.size + obj.size) / 2;
  }

  show() {
    const img = this.direction === -1 ? playerLeftImg : playerRightImg;
    const tilt = (this.velocityX / MOVE_TUNING.maxSpeed) * MOVE_TUNING.tiltRadians;

    push();
    translate(this.x + this.size / 2, this.y);
    rotate(tilt);
    image(img, -this.size / 2, -this.size / 2, this.size, this.size);
    pop();
  }
}
