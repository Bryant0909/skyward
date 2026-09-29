import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

const iife = (body) => `(() => {\n${body}\n})()`;

describe('horizontal movement', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame(); player.x = 400;");
  });

  /** Holds a direction for N frames, releases for M, and returns per-frame movement. */
  function trace(g, hold, release) {
    return JSON.parse(g.run(iife(`
      const xs = [];
      for (let i = 0; i < ${hold + release}; i++) {
        const before = player.x;
        if (i < ${hold}) player.move(1);
        player.update();
        xs.push(player.x - before);
      }
      return JSON.stringify(xs);
    `)));
  }

  // Previously this.x += dir * pace, giving 0 -> 5 -> 0 with no transition.
  it('accelerates rather than snapping to full speed', () => {
    const xs = trace(g, 10, 0);
    expect(xs[0]).toBeGreaterThan(0);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('coasts to a stop instead of halting instantly', () => {
    const xs = trace(g, 20, 30);
    const afterRelease = xs.slice(20);
    expect(afterRelease[0]).toBeGreaterThan(0);            // still sliding
    expect(afterRelease[0]).toBeLessThan(xs[19]);          // but slower than before
    expect(afterRelease[afterRelease.length - 1]).toBe(0); // eventually stopped
  });

  /**
   * Coast distance is what actually affects control: clouds are 100px wide and
   * the player 40px, so landings tolerate roughly 30px of error. Sliding much
   * further would feel like ice.
   */
  it('coasts less than half a cloud width', () => {
    const xs = trace(g, 25, 40);
    const coast = xs.slice(25).reduce((a, b) => a + b, 0);
    expect(coast).toBeGreaterThan(5);
    expect(coast).toBeLessThan(30);
  });

  it('keeps per-frame change well below the old 5 px/frame step', () => {
    const xs = trace(g, 12, 12);
    let worst = 0;
    for (let i = 1; i < xs.length; i++) worst = Math.max(worst, Math.abs(xs[i] - xs[i - 1]));
    expect(worst).toBeLessThan(1.5);
  });

  it('respects the speed cap', () => {
    const xs = trace(g, 40, 0);
    const maxSpeed = g.run('MOVE_TUNING.maxSpeed');
    expect(Math.max(...xs)).toBeLessThanOrEqual(maxSpeed + 1e-9);
    expect(Math.max(...xs)).toBeCloseTo(maxSpeed, 5);
  });

  it('accelerates more slowly in the air', () => {
    const ground = g.run(iife(`
      player.currentCloud = clouds[3];
      player.velocityX = 0;
      player.move(1); player.updateHorizontal();
      return player.velocityX;
    `));
    const air = g.run(iife(`
      player.currentCloud = null;
      player.y = 200;
      player.velocityX = 0;
      player.move(1); player.updateHorizontal();
      return player.velocityX;
    `));
    expect(air).toBeLessThan(ground);
  });

  it('stops dead at the edges without banking speed', () => {
    const r = g.run(iife(`
      player.x = canvasWidth - player.size / 2 - 1;
      for (let i = 0; i < 20; i++) { player.move(1); player.updateHorizontal(); }
      return JSON.stringify({ x: player.x, vx: player.velocityX,
                              limit: canvasWidth - player.size / 2 });
    `));
    const { x, vx, limit } = JSON.parse(r);
    expect(x).toBeCloseTo(limit, 5);
    expect(vx).toBe(0);
  });

  it('does not drift without input', () => {
    const xs = trace(g, 0, 10);
    expect(xs.every((v) => v === 0)).toBe(true);
  });
});

describe('moving cloud carry', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='hard'; startNewGame();");
  });

  it('reports its per-frame movement', () => {
    const d = g.run(iife(`
      const c = new MovingCloud(400, 300);
      c.speed = 2; c.direction = 1;
      c.move();
      return c.lastDelta;
    `));
    expect(d).toBeCloseTo(2, 5);
  });

  // The old approach snapped the player to the cloud position plus a fixed
  // offset, which overwrote the player's own momentum.
  it('composes with the player own momentum', () => {
    const r = g.run(iife(`
      const c = new MovingCloud(400, 300);
      c.speed = 2; c.direction = 1;
      player.x = c.x - player.size / 2;
      player.prevY = player.y = c.y - c.h / 2 - player.size / 2;
      player.velocity = 0;
      player.currentCloud = c;
      player.velocityX = 3;          // still sliding right
      const x0 = player.x;
      c.move();
      player.update();
      return JSON.stringify({ moved: player.x - x0, cloudDelta: c.lastDelta });
    `));
    const { moved, cloudDelta } = JSON.parse(r);
    expect(moved).toBeGreaterThan(cloudDelta);
    expect(moved).toBeGreaterThan(3);
  });
});

describe('sprite tilt', () => {
  it('draws at any velocity without error', () => {
    const g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
    expect(() => g.run('player.velocityX = 5; player.show();')).not.toThrow();
    expect(() => g.run('player.velocityX = -5; player.show();')).not.toThrow();
    expect(() => g.run('player.velocityX = 0; player.show();')).not.toThrow();
  });
});

describe('cloud sprite size', () => {
  it('sits between the collision height and the natural aspect ratio', () => {
    const g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
    const r = g.run(iife(`
      const c = clouds[0];
      const natural = c.w * (cloudImg.height / cloudImg.width);
      return JSON.stringify({ sprite: c.spriteHeight(), collision: c.h, natural });
    `));
    const { sprite, collision, natural } = JSON.parse(r);
    expect(sprite).toBeGreaterThan(collision);   // thicker than the old flat line
    expect(sprite).toBeLessThan(natural);        // not tall enough to hide the level above
  });
});
