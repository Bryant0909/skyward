import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

const iife = (body) => `(() => {\n${body}\n})()`;

describe('pause', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
  });

  it('toggles on Esc or P during play', () => {
    expect(g.run('paused')).toBe(false);
    g.run('keyCode = 27; keyPressed();');
    expect(g.run('paused')).toBe(true);
    g.run('keyCode = 80; keyPressed();');
    expect(g.run('paused')).toBe(false);
  });

  it('freezes the world', () => {
    const r = g.run(iife(`
      player.velocity = 5;
      paused = true;
      const snapshot = {
        y: player.y,
        cloudX: clouds.map(c => c.x).join(','),
        plat: plateform.y,
      };
      for (let i = 0; i < 20; i++) drawGame();
      return JSON.stringify({
        ySame: player.y === snapshot.y,
        cloudsSame: clouds.map(c => c.x).join(',') === snapshot.cloudX,
        platSame: plateform.y === snapshot.plat,
      });
    `));
    const { ySame, cloudsSame, platSame } = JSON.parse(r);
    expect(ySame).toBe(true);
    expect(cloudsSame).toBe(true);
    expect(platSame).toBe(true);
  });

  it('suspends collision checks', () => {
    const lifeAfter = g.run(iife(`
      selectedDifficulty = 'hard';
      startNewGame();
      const d = objects.find(o => o instanceof Danger);
      d.move();
      player.x = d.x + d.size / 2 - player.size / 2;
      player.prevY = player.y = d.cloud.y - d.cloud.h / 2 - player.size / 2;
      paused = true;
      for (let i = 0; i < 10; i++) drawGame();
      return life;
    `));
    expect(lifeAfter).toBe(3);
  });

  it('resumes normally', () => {
    const moved = g.run(iife(`
      paused = true;
      for (let i = 0; i < 5; i++) drawGame();
      paused = false;
      // The player starts on the ground, where velocity would be clamped
      // straight back, so lift them into the air first.
      player.currentCloud = null;
      player.y = 200;
      player.velocity = 6;
      const y0 = player.y;
      for (let i = 0; i < 5; i++) drawGame();
      return player.y !== y0;
    `));
    expect(moved).toBe(true);
  });

  it('is cleared by a game reset', () => {
    g.run('paused = true; resetGameData();');
    expect(g.run('paused')).toBe(false);
  });
});

describe('mute', () => {
  let g;
  beforeEach(() => { g = loadGame(); });

  it('toggles on M and applies to every sound', () => {
    expect(g.run('muted')).toBe(false);
    expect(g.run('allSounds().every(s => s._volume === 1)')).toBe(true);

    g.run('keyCode = 77; keyPressed();');
    expect(g.run('muted')).toBe(true);
    expect(g.run('allSounds().every(s => s._volume === 0)')).toBe(true);

    g.run('keyCode = 77; keyPressed();');
    expect(g.run('muted')).toBe(false);
    expect(g.run('allSounds().every(s => s._volume === 1)')).toBe(true);
  });

  it('works during play too', () => {
    g.run("selectedDifficulty='easy'; startNewGame(); keyCode = 77; keyPressed();");
    expect(g.run('muted')).toBe(true);
  });

  it('covers every loaded sound', () => {
    expect(g.run('allSounds().length')).toBe(6);
    expect(g.run('allSounds().every(s => s && typeof s.setVolume === "function")')).toBe(true);
  });
});

describe('damage feedback', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
  });

  it('triggers a flash and a shake on losing a life', () => {
    g.run('damageFlash = 0; shakeFrames = 0; player.loseLife();');
    expect(g.run('damageFlash')).toBe(g.run('DAMAGE_FLASH_FRAMES'));
    expect(g.run('shakeFrames')).toBe(g.run('DAMAGE_SHAKE_FRAMES'));
  });

  it('decays back to zero', () => {
    const r = g.run(iife(`
      player.loseLife();
      for (let i = 0; i < DAMAGE_FLASH_FRAMES + 5; i++) drawGame();
      return JSON.stringify({ damageFlash, shakeFrames });
    `));
    const { damageFlash, shakeFrames } = JSON.parse(r);
    expect(damageFlash).toBe(0);
    expect(shakeFrames).toBe(0);
  });

  it('does not decay while paused', () => {
    const after = g.run(iife(`
      player.loseLife();
      paused = true;
      const before = damageFlash;
      for (let i = 0; i < 10; i++) drawGame();
      return JSON.stringify({ before, after: damageFlash });
    `));
    const { before, after: a } = JSON.parse(after);
    expect(a).toBe(before);
  });

  it('is cleared by a game reset', () => {
    g.run('damageFlash = 10; shakeFrames = 5; resetGameData();');
    expect(g.run('damageFlash')).toBe(0);
    expect(g.run('shakeFrames')).toBe(0);
  });
});

describe('sound mapping', () => {
  // ghost.mp3 was loaded but never played.
  it('uses ghost for monsters and fire for hellfire', () => {
    const g = loadGame();
    const r = g.run(iife(`
      selectedDifficulty = 'hard';
      startNewGame();
      ghostSound._plays = 0;
      fireSound._plays = 0;

      const hitOne = (Type) => {
        const o = objects.find(x => Type === Monster ? x instanceof Monster
                                                     : (x instanceof Danger && !(x instanceof Monster)));
        o.move();
        player.x = o.x + o.size / 2 - player.size / 2;
        player.prevY = player.y = o.cloud.y - o.cloud.h / 2 - player.size / 2;
        life = 3;
        drawGame();
      };

      hitOne(Monster);
      const afterMonster = { ghost: ghostSound._plays, fire: fireSound._plays };
      hitOne(Danger);
      return JSON.stringify({ afterMonster, ghost: ghostSound._plays, fire: fireSound._plays });
    `));
    const { afterMonster, fire } = JSON.parse(r);
    expect(afterMonster.ghost).toBeGreaterThan(0);
    expect(afterMonster.fire).toBe(0);
    expect(fire).toBeGreaterThan(0);
  });
});
