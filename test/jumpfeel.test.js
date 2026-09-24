import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

const iife = (body) => `(() => {\n${body}\n})()`;

/** Stands the player on a cloud with the coyote counter full. */
const STAND_ON_CLOUD = iife(`
  const c = clouds.find(x => !(x instanceof MovingCloud) && x.y < 500 && x.y > 200);
  player.x = c.x - player.size / 2;
  player.prevY = player.y = c.y - c.h / 2 - player.size / 2;
  player.velocity = 0;
  player.currentCloud = c;
  player.isStart = false;
  player.updateJumpAssist();
`);

describe('coyote time', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
    g.run(STAND_ON_CLOUD);
  });

  it('is full while grounded', () => {
    expect(g.run('player.coyoteFrames')).toBe(g.run('JUMP_TUNING.coyoteFrames'));
  });

  // Without this, stepping off a cloud makes jumping impossible immediately,
  // and the input feels dropped.
  it.each([0, 1, 3, 5])('still allows a jump %i frames after leaving', (delay) => {
    const v = g.run(iife(`
      player.currentCloud = null;          // stepped off the edge
      player.y = 250;                      // clear of the ground
      for (let i = 0; i < ${delay}; i++) player.updateJumpAssist();
      player.requestJump();
      player.updateJumpAssist();
      return player.velocity;
    `));
    expect(v).toBe(g.run('player.jumpPower'));
  });

  it('expires after the grace period', () => {
    const v = g.run(iife(`
      player.currentCloud = null;
      player.y = 250;
      for (let i = 0; i < JUMP_TUNING.coyoteFrames; i++) player.updateJumpAssist();
      player.requestJump();
      player.updateJumpAssist();
      return player.velocity;
    `));
    expect(v).toBe(0);
  });

  it('is consumed by the jump, preventing a double jump', () => {
    const v = g.run(iife(`
      player.requestJump();
      player.updateJumpAssist();
      const first = player.velocity;
      player.jumpHeld = false;             // release and press again
      player.velocity = 0;                 // pretend we reached the apex
      player.requestJump();
      player.updateJumpAssist();
      return JSON.stringify({ first, second: player.velocity });
    `));
    const { first, second } = JSON.parse(v);
    expect(first).toBe(g.run('player.jumpPower'));
    expect(second).toBe(0);
  });
});

describe('jump buffer', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
    g.run(STAND_ON_CLOUD);
  });

  it('fires a jump pressed shortly before landing', () => {
    const r = g.run(iife(`
      player.currentCloud = null;
      player.y = 250;
      player.velocity = 6;
      for (let i = 0; i < JUMP_TUNING.coyoteFrames + 2; i++) player.updateJumpAssist();
      player.requestJump();                // pressed early
      const beforeLanding = player.velocity;

      player.updateJumpAssist();
      player.updateJumpAssist();
      const stillFalling = player.velocity;

      player.currentCloud = clouds[4];     // lands
      player.velocity = 0;
      player.updateJumpAssist();
      return JSON.stringify({ beforeLanding, stillFalling, afterLanding: player.velocity });
    `));
    const { stillFalling, afterLanding } = JSON.parse(r);
    expect(stillFalling).toBeGreaterThan(0);
    expect(afterLanding).toBe(g.run('player.jumpPower'));
  });

  it('expires if pressed far too early', () => {
    const v = g.run(iife(`
      player.currentCloud = null;
      player.y = 250;
      player.velocity = 6;
      for (let i = 0; i < JUMP_TUNING.coyoteFrames + 2; i++) player.updateJumpAssist();
      player.requestJump();
      for (let i = 0; i < JUMP_TUNING.bufferFrames + 2; i++) player.updateJumpAssist();
      player.currentCloud = clouds[4];
      player.velocity = 0;
      player.updateJumpAssist();
      return player.velocity;
    `));
    expect(v).toBe(0);
  });

  // Key auto-repeat would otherwise refill the buffer, turning a held key into
  // continuous bouncing, which is exactly what this game replaced.
  it('ignores key auto-repeat', () => {
    const r = g.run(iife(`
      player.requestJump();
      player.updateJumpAssist();
      const first = player.velocity;

      let rejumped = false;
      for (let i = 0; i < 30; i++) {
        player.requestJump();              // simulated auto-repeat
        player.velocity = 0;               // pretend we stay on the cloud
        player.currentCloud = clouds[4];
        player.updateJumpAssist();
        if (player.velocity < 0) rejumped = true;
      }
      return JSON.stringify({ first, rejumped });
    `));
    const { first, rejumped } = JSON.parse(r);
    expect(first).toBe(g.run('player.jumpPower'));
    expect(rejumped).toBe(false);
  });

  it('allows another jump after a real release', () => {
    const v = g.run(iife(`
      player.requestJump();
      player.updateJumpAssist();
      player.releaseJump();
      player.velocity = 0;
      player.currentCloud = clouds[4];
      player.requestJump();
      player.updateJumpAssist();
      return player.velocity;
    `));
    expect(v).toBe(g.run('player.jumpPower'));
  });
});

describe('variable jump height', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
    g.run(STAND_ON_CLOUD);
  });

  it('cuts the rise when released mid-ascent', () => {
    const r = g.run(iife(`
      player.requestJump();
      player.updateJumpAssist();
      const full = player.velocity;
      player.releaseJump();
      return JSON.stringify({ full, cut: player.velocity });
    `));
    const { full, cut } = JSON.parse(r);
    expect(cut).toBeCloseTo(full * g.run('JUMP_TUNING.cutMultiplier'), 6);
  });

  it('does nothing when released while already falling', () => {
    const v = g.run(iife(`
      player.velocity = 7;
      player.releaseJump();
      return player.velocity;
    `));
    expect(v).toBe(7);
  });

  it('gives a tapped jump enough height for one level', () => {
    const r = g.run(iife(`
      const gravity = player.gravity;
      const apex = (v0) => (v0 * v0) / (2 * gravity);

      player.requestJump();
      player.updateJumpAssist();
      const heldApex = apex(Math.abs(player.velocity));

      player.releaseJump();
      const tappedApex = apex(Math.abs(player.velocity));
      return JSON.stringify({ heldApex, tappedApex });
    `));
    const { heldApex, tappedApex } = JSON.parse(r);
    expect(heldApex).toBeGreaterThan(tappedApex * 1.5);
    expect(tappedApex).toBeGreaterThan(55);   // levels are 60-90px apart
    expect(heldApex).toBeGreaterThan(130);
  });
});

describe('jump entry points', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
    g.run(STAND_ON_CLOUD);
  });

  // tryJump() only registers intent; updateJumpAssist() decides when to jump.
  it('registers intent without changing velocity', () => {
    g.run('tryJump();');
    expect(g.run('player.velocity')).toBe(0);
    expect(g.run('player.jumpBufferFrames')).toBeGreaterThan(0);
  });

  it('jumps on the next update', () => {
    g.run('tryJump(); player.update();');
    expect(g.run('player.velocity')).toBeLessThan(0);
  });

  it('is safe to call with no player', () => {
    g.run('resetGameData();');
    expect(() => g.run('tryJump();')).not.toThrow();
    expect(() => g.run('releaseJump();')).not.toThrow();
  });
});
