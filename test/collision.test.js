import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

describe('object collision', () => {
  let g;
  beforeEach(() => {
    g = loadGame();
    g.run("selectedDifficulty='easy'; startNewGame();");
  });

  it('bounds() matches where show() draws', () => {
    // Candy is offset 20px down so it looks like it rests on the cloud. The
    // hitbox has to follow, or the visible and hittable areas diverge.
    const r = g.run(`
      const c = new Candy(clouds[5]);
      JSON.stringify({ drawY: c.y + c.drawOffsetY, top: c.bounds().top,
                       bottom: c.bounds().bottom, size: c.size })
    `);
    const { drawY, top, bottom, size } = JSON.parse(r);
    expect(top).toBe(drawY);
    expect(bottom - top).toBe(size);
  });

  it('leaves other objects unoffset', () => {
    expect(g.run('new Halo(clouds[5]).drawOffsetY')).toBe(0);
    expect(g.run('new Danger(clouds[5]).drawOffsetY')).toBe(0);
  });

  it('registers a hit when standing on an object', () => {
    const hit = g.run(`
      const cl = clouds[5];
      const c = new Candy(cl);
      player.x = c.x + c.size / 2 - player.size / 2;
      player.prevY = player.y = cl.y - cl.h / 2 - player.size / 2;
      player.collidesWith(c)
    `);
    expect(hit).toBe(true);
  });

  // Regression: an instant check against a 5px band missed most objects,
  // because falling speed reaches 15-25 px/frame.
  it.each([12, 20, 35, 60, 90])('still hits at %ipx per frame', (step) => {
    const hit = g.run(`
      const cl = clouds[5];
      const c = new Candy(cl);
      const box = c.bounds();
      player.x = c.x + c.size / 2 - player.size / 2;
      let y = box.top - 150, found = false;
      for (let i = 0; i < 40 && y < box.bottom + 150; i++) {
        player.prevY = y;
        y += ${step};
        player.y = y;
        if (player.collidesWith(c)) found = true;
      }
      found
    `);
    expect(hit).toBe(true);
  });

  it('does not fire when horizontally far away', () => {
    const hit = g.run(`
      const cl = clouds[5];
      const c = new Candy(cl);
      player.x = c.x + 300;
      player.prevY = player.y = cl.y - cl.h / 2 - player.size / 2;
      player.collidesWith(c)
    `);
    expect(hit).toBe(false);
  });

  it('does not fire when vertically far away', () => {
    const hit = g.run(`
      const cl = clouds[5];
      const c = new Candy(cl);
      player.x = c.x + c.size / 2 - player.size / 2;
      player.prevY = player.y = c.bounds().top - 400;
      player.collidesWith(c)
    `);
    expect(hit).toBe(false);
  });

  // The check used to be instanceof Object, which every object passes.
  it('ignores anything that is not a game object', () => {
    expect(g.run('player.collidesWith({ x: player.x, y: player.y, size: 30 })')).toBe(false);
    expect(g.run('player.collidesWith(clouds[5])')).toBe(false);
  });
});
