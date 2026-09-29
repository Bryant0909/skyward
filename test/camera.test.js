import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

/**
 * Snippets run inside the game are wrapped in an IIFE. Top-level let/const
 * persist in the context's lexical scope, so declaring the same name twice
 * throws a SyntaxError.
 */
const iife = (body) => `(() => {\n${body}\n})()`;

/**
 * Places the player on a static cloud above the rest line and lets the
 * scheduled camera step finish. Afterwards the player sits exactly on the rest
 * line with cameraPending back at zero.
 */
const SETTLE = iife(`
  const restY = canvasHeight / 2;
  const t = clouds.find(c => c.y < restY && c.y > 160 && !(c instanceof MovingCloud));
  player.x = t.x - player.size / 2;
  player.prevY = player.y = t.y - t.h / 2 - player.size / 2;
  player.velocity = 0;
  player.currentCloud = t;
  player.isStart = false;
  scheduleCameraStep(player);
  for (let i = 0; i < 200 && cameraPending !== 0; i++) player.update();
`);

describe('camera', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
  });

  it('settles the player back on the rest line', () => {
    g.run(SETTLE);
    expect(g.run('cameraPending')).toBe(0);
    expect(g.run('Math.abs(player.y - canvasHeight / 2) < 1')).toBe(true);
  });

  // The whole point of the step camera: previously the world was pulled toward
  // the player every frame, so the jump arc was mirrored onto the screen.
  it('does not move at all while rising', () => {
    g.run(SETTLE);
    const maxMove = g.run(iife(`
      const p0 = plateform.y;
      player.jump();
      let worst = 0, guard = 0;
      while (player.velocity < 0 && guard++ < 200) {
        player.update();
        worst = Math.max(worst, Math.abs(plateform.y - p0));
      }
      return worst;
    `));
    expect(maxMove).toBe(0);
  });

  /**
   * The broader invariant: as long as the player is airborne and has not
   * dropped below the rest line, the camera stays still — rising or falling.
   *
   * Note that "straight up lands back in the same place" does not hold: levels
   * are 60-90px apart and a jump reaches about 140px, so jumping upward often
   * lands a level higher, where stepping the camera is correct.
   */
  it('stays still while airborne above the rest line', () => {
    g.run(SETTLE);
    const r = g.run(iife(`
      const restY = canvasHeight / 2;
      let airborneFrames = 0, movedWhileAirborne = 0;
      player.jump();
      for (let i = 0; i < 120; i++) {
        const wasAirborne = !player.currentCloud && player.y <= restY;
        const before = plateform.y;
        player.update();
        // The landing frame is excluded: that is exactly when the camera
        // should start moving. Only fully airborne frames are counted.
        if (wasAirborne && !player.currentCloud) {
          airborneFrames++;
          movedWhileAirborne += Math.abs(plateform.y - before);
        }
      }
      return JSON.stringify({ airborneFrames, movedWhileAirborne });
    `));
    const { airborneFrames, movedWhileAirborne } = JSON.parse(r);
    expect(airborneFrames).toBeGreaterThan(10);
    expect(movedWhileAirborne).toBe(0);
  });

  it('schedules a step only after landing higher', () => {
    g.run(SETTLE);
    // Drives updateCamera() directly rather than update(), which re-snaps the
    // player to its cloud every frame and would overwrite the y set here.
    const r = g.run(iife(`
      const restY = canvasHeight / 2;
      player.currentCloud = null;
      player.y = restY - 70;
      cameraPending = 0;
      scheduleCameraStep(player);
      const scheduled = cameraPending;
      const p0 = plateform.y;
      for (let i = 0; i < 200 && cameraPending !== 0; i++) updateCamera(player);
      return JSON.stringify({ scheduled, worldMoved: plateform.y - p0, endY: player.y });
    `));
    const { scheduled, worldMoved, endY } = JSON.parse(r);
    expect(scheduled).toBeCloseTo(70, 5);
    expect(worldMoved).toBeCloseTo(70, 5);
    expect(endY).toBeCloseTo(g.run('canvasHeight / 2'), 5);
  });

  it('schedules nothing when landing below the rest line', () => {
    g.run(SETTLE);
    const pending = g.run(iife(`
      player.y = canvasHeight / 2 + 50;
      cameraPending = 0;
      scheduleCameraStep(player);
      return cameraPending;
    `));
    expect(pending).toBe(0);
  });

  it('follows continuously once below the rest line', () => {
    g.run(SETTLE);
    const framesMoved = g.run(iife(`
      player.currentCloud = null;
      player.y = canvasHeight / 2 + 80;
      player.velocity = 8;
      let n = 0;
      for (let i = 0; i < 10; i++) {
        const before = plateform.y;
        updateCamera(player);
        if (Math.abs(plateform.y - before) > 0.001) n++;
      }
      return n;
    `));
    expect(framesMoved).toBeGreaterThan(5);
  });

  it('cancels a pending step when the player starts falling', () => {
    g.run(SETTLE);
    const pending = g.run(iife(`
      player.y = canvasHeight / 2 - 90;
      scheduleCameraStep(player);
      player.currentCloud = null;
      player.y = canvasHeight / 2 + 60;
      updateCamera(player);
      return cameraPending;
    `));
    expect(pending).toBe(0);
  });

  /**
   * A spring jump is 1.5x powered (-22.5), peaking around 316px. From the rest
   * line at y=300 that would reach y=-16, off the top of the screen, so the
   * camera needs a ceiling that forces it to follow.
   */
  it('forces the camera to follow above the ceiling', () => {
    g.run(SETTLE);
    const r = g.run(iife(`
      const ceiling = statusAreaHeight + CAMERA_CEILING_MARGIN;
      player.currentCloud = null;
      player.y = ceiling - 80;
      const p0 = plateform.y;
      updateCamera(player);
      return JSON.stringify({ ceiling, y: player.y, worldMoved: plateform.y - p0 });
    `));
    const { ceiling, y, worldMoved } = JSON.parse(r);
    expect(y).toBeCloseTo(ceiling, 5);      // clamped to the ceiling
    expect(worldMoved).toBeCloseTo(80, 5);  // world shifted by the same amount
  });

  it('keeps a spring jump on screen', () => {
    g.run(SETTLE);
    const r = g.run(iife(`
      const spring = new SpringCloud(player.x + player.size / 2, player.y + player.size / 2 + 10);
      player.currentCloud = spring;
      player.jumpMultiplier = spring.jumpMultiplier();
      player.jump();

      let highest = player.y;
      for (let i = 0; i < 80 && player.velocity < 0; i++) {
        player.update();
        highest = Math.min(highest, player.y);
      }
      return JSON.stringify({ highest, spriteTop: highest - player.size / 2,
                              statusBar: statusAreaHeight });
    `));
    const { spriteTop, statusBar } = JSON.parse(r);
    expect(spriteTop).toBeGreaterThanOrEqual(statusBar);
  });

  it('leaves a normal jump untouched by the ceiling', () => {
    g.run(SETTLE);
    const moved = g.run(iife(`
      const p0 = plateform.y;
      player.jumpMultiplier = 1;
      player.jump();
      let worst = 0, guard = 0;
      while (player.velocity < 0 && guard++ < 200) {
        player.update();
        worst = Math.max(worst, Math.abs(plateform.y - p0));
      }
      return worst;
    `));
    expect(moved).toBe(0);
  });

  it('resets camera state with the game', () => {
    g.run('cameraPending = 123; resetGameData();');
    expect(g.run('cameraPending')).toBe(0);
  });
});
