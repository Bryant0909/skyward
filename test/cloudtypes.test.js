import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

const iife = (body) => `(() => {\n${body}\n})()`;

describe('spring cloud', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
  });

  it('multiplies jump power above the plain cloud baseline', () => {
    expect(g.run('new Cloud(400, 300).jumpMultiplier()')).toBe(1);
    expect(g.run('new SpringCloud(400, 300).jumpMultiplier()')).toBeGreaterThan(1);
  });

  it('applies the boost on the next jump', () => {
    const r = g.run(iife(`
      const spring = new SpringCloud(400, 300);
      const plain = new Cloud(400, 300);

      player.currentCloud = plain;
      player.jumpMultiplier = plain.jumpMultiplier();
      player.jump();
      const plainJump = player.velocity;

      player.currentCloud = spring;
      player.jumpMultiplier = spring.jumpMultiplier();
      player.jump();
      const springJump = player.velocity;

      return JSON.stringify({ plainJump, springJump, boost: spring.boost });
    `));
    const { plainJump, springJump, boost } = JSON.parse(r);
    expect(springJump).toBeCloseTo(plainJump * boost, 6);
    expect(Math.abs(springJump)).toBeGreaterThan(Math.abs(plainJump));
  });

  // Coyote time allows jumping after currentCloud is already null, so the
  // multiplier has to be captured on landing rather than read at jump time.
  it('survives a coyote-time jump after stepping off', () => {
    const v = g.run(iife(`
      const spring = new SpringCloud(400, 300);
      player.currentCloud = spring;
      player.jumpMultiplier = spring.jumpMultiplier();
      player.updateJumpAssist();        // fill coyote
      player.currentCloud = null;       // step off the edge
      player.y = 250;
      player.velocity = 0;
      player.requestJump();
      player.updateJumpAssist();
      return player.velocity;
    `));
    expect(v).toBeCloseTo(g.run('player.jumpPower * 1.5'), 6);
  });

  it('is cleared by landing on the ground', () => {
    const m = g.run(iife(`
      player.jumpMultiplier = 1.5;
      player.y = plateform.y;
      player.update();
      return player.jumpMultiplier;
    `));
    expect(m).toBe(1);
  });
});

describe('vanishing cloud', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='medium'; startNewGame();");
  });

  it('stays solid until touched', () => {
    const solid = g.run(iife(`
      const c = new VanishingCloud(400, 300);
      for (let i = 0; i < 200; i++) c.move();
      return c.isSolid();
    `));
    expect(solid).toBe(true);
  });

  it('fades out over a fixed number of frames', () => {
    const r = g.run(iife(`
      const c = new VanishingCloud(400, 300);
      c.onLanded();
      const mid = (() => {
        for (let i = 0; i < c.fadeFrames - 1; i++) c.move();
        return c.isSolid();
      })();
      c.move();
      return JSON.stringify({ mid, after: c.isSolid(), frames: c.fadeFrames });
    `));
    const { mid, after } = JSON.parse(r);
    expect(mid).toBe(true);     // still standable while fading
    expect(after).toBe(false);
  });

  it('detaches the player when it disappears', () => {
    const r = g.run(iife(`
      const c = new VanishingCloud(player.x + player.size / 2, 300);
      player.prevY = player.y = c.y - c.h / 2 - player.size / 2;
      player.velocity = 0;
      player.currentCloud = c;
      c.onLanded();
      for (let i = 0; i < c.fadeFrames; i++) c.move();
      const goneButAttached = !!player.currentCloud;
      player.update();
      return JSON.stringify({ goneButAttached, attachedAfter: !!player.currentCloud });
    `));
    const { attachedAfter } = JSON.parse(r);
    expect(attachedAfter).toBe(false);
  });

  it('cannot be landed on again once gone', () => {
    const landed = g.run(iife(`
      const c = new VanishingCloud(player.x + player.size / 2, 300);
      c.onLanded();
      for (let i = 0; i < c.fadeFrames; i++) c.move();
      clouds.length = 0;
      clouds.push(c);
      player.currentCloud = null;
      player.prevY = c.y - 40;
      player.y = c.y + 5;
      player.velocity = 10;
      player.update();
      return !!player.currentCloud;
    `));
    expect(landed).toBe(false);
  });
});

describe('falling cloud', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='hard'; startNewGame();");
  });

  it('stays put until touched', () => {
    const y = g.run(iife(`
      const c = new FallingCloud(400, 300);
      for (let i = 0; i < 60; i++) c.move();
      return c.y;
    `));
    expect(y).toBe(300);
  });

  it('accelerates downward once landed on', () => {
    const r = g.run(iife(`
      const c = new FallingCloud(400, 300);
      c.onLanded();
      c.move();
      const firstStep = c.y - 300;
      const before = c.y;
      for (let i = 0; i < 10; i++) c.move();
      const laterStep = (c.y - before) / 10;
      return JSON.stringify({ firstStep, laterStep });
    `));
    const { firstStep, laterStep } = JSON.parse(r);
    expect(firstStep).toBeGreaterThan(0);
    expect(laterStep).toBeGreaterThan(firstStep);
  });

  it('stops being a platform once off-screen', () => {
    const solid = g.run(iife(`
      const c = new FallingCloud(400, 300);
      c.onLanded();
      for (let i = 0; i < 200; i++) c.move();
      return c.isSolid();
    `));
    expect(solid).toBe(false);
  });

  it('carries the player down with it', () => {
    const r = g.run(iife(`
      const c = new FallingCloud(player.x + player.size / 2, 300);
      player.prevY = player.y = c.y - c.h / 2 - player.size / 2;
      player.velocity = 0;
      player.currentCloud = c;
      c.onLanded();
      const y0 = player.y;
      for (let i = 0; i < 8; i++) { c.move(); player.update(); }
      return JSON.stringify({ moved: player.y - y0, stillOn: !!player.currentCloud,
                              gap: Math.abs((c.y - c.h / 2 - player.size / 2) - player.y) });
    `));
    const { moved, stillOn, gap } = JSON.parse(r);
    expect(moved).toBeGreaterThan(5);
    expect(stillOn).toBe(true);
    expect(gap).toBeLessThan(1);   // not left floating above the cloud
  });
});

describe('cloud mix', () => {
  /** Aggregated across seeds so a single random sequence cannot cause a flake. */
  function census(difficulty) {
    const total = { Cloud: 0, MovingCloud: 0, SpringCloud: 0, VanishingCloud: 0, FallingCloud: 0 };
    for (const seed of [1, 7, 42, 1234, 99999]) {
      const g = loadGame({ seed });
      g.run(`selectedDifficulty='${difficulty}'; startNewGame();`);
      const counts = JSON.parse(g.run(`JSON.stringify(
        clouds.reduce((acc, c) => { acc[c.constructor.name] = (acc[c.constructor.name] || 0) + 1; return acc; }, {})
      )`));
      for (const k of Object.keys(counts)) total[k] = (total[k] || 0) + counts[k];
    }
    return total;
  }

  it('keeps easy free of vanishing and falling clouds', () => {
    const c = census('easy');
    expect(c.VanishingCloud).toBe(0);
    expect(c.FallingCloud).toBe(0);
    expect(c.SpringCloud).toBeGreaterThan(0);
  });

  it('adds vanishing clouds on medium but not falling ones', () => {
    const c = census('medium');
    expect(c.VanishingCloud).toBeGreaterThan(0);
    expect(c.FallingCloud).toBe(0);
  });

  it('uses all three special types on hard', () => {
    const c = census('hard');
    expect(c.SpringCloud).toBeGreaterThan(0);
    expect(c.VanishingCloud).toBeGreaterThan(0);
    expect(c.FallingCloud).toBeGreaterThan(0);
  });

  it('keeps ordinary clouds in the majority', () => {
    const c = census('hard');
    const special = c.SpringCloud + c.VanishingCloud + c.FallingCloud;
    expect(c.Cloud + c.MovingCloud).toBeGreaterThan(special);
  });

  // Climbing all the way up only to land on a vanishing cloud would be the
  // worst possible way to lose a run.
  it('always puts the halo on a plain cloud', () => {
    for (const seed of [1, 7, 42, 1234, 99999]) {
      const g = loadGame({ seed });
      g.run("selectedDifficulty='hard'; startNewGame();");
      expect(g.run('clouds[clouds.length - 1].constructor.name')).toBe('Cloud');
      expect(g.run('objects[objects.length - 1] instanceof Halo')).toBe(true);
    }
  });

  it('never places items on unstable clouds', () => {
    for (const seed of [1, 42, 99999]) {
      const g = loadGame({ seed });
      g.run("selectedDifficulty='hard'; startNewGame();");
      const bad = g.run(`
        objects.filter(o => !canHoldItem(o.cloud) && o.constructor.name !== 'Objects').length
      `);
      expect(bad).toBe(0);
    }
  });
});
