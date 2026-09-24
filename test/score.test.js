import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

describe('Score', () => {
  let g;
  beforeEach(() => { g = loadGame(); });

  it('is altitude / 10 plus 50 per candy', () => {
    g.run('Score.reset(); Score.updateHeight(1200); Score.addCandy(); Score.addCandy();');
    expect(g.run('Score.current()')).toBe(120 + 100);
  });

  it('adds the win bonus only once won is set', () => {
    g.run('Score.reset(); Score.updateHeight(500);');
    expect(g.run('Score.current()')).toBe(50);
    g.run('Score.won = true;');
    expect(g.run('Score.current()')).toBe(50 + 1000);
  });

  it('keeps the highest altitude, so falling costs nothing', () => {
    g.run('Score.reset(); Score.updateHeight(2000); Score.updateHeight(300);');
    expect(g.run('Score.maxHeight')).toBe(2000);
    expect(g.run('Score.current()')).toBe(200);
  });

  it('clears the previous run on reset', () => {
    g.run('Score.reset(); Score.updateHeight(900); Score.addCandy(); Score.won = true;');
    g.run('Score.reset();');
    expect(g.run('Score.current()')).toBe(0);
    expect(g.run('Score.won')).toBe(false);
  });

  it('reports zero when nothing is stored', () => {
    expect(g.run("Score.best('easy')")).toBe(0);
  });

  it('writes only on a new record', () => {
    g.run('Score.reset(); Score.updateHeight(1000);');        // 100 points
    expect(g.run("Score.save('easy')")).toBe(true);
    expect(g.run("Score.best('easy')")).toBe(100);

    g.run('Score.reset(); Score.updateHeight(500);');          // lower score
    expect(g.run("Score.save('easy')")).toBe(false);
    expect(g.run("Score.best('easy')")).toBe(100);
  });

  it('does not treat a tie as a new record', () => {
    g.run('Score.reset(); Score.updateHeight(1000);');
    g.run("Score.save('easy');");
    g.run('Score.reset(); Score.updateHeight(1000);');
    expect(g.run("Score.save('easy')")).toBe(false);
  });

  it('keeps each difficulty separate', () => {
    g.run('Score.reset(); Score.updateHeight(1000);');
    g.run("Score.save('easy');");
    expect(g.run("Score.best('easy')")).toBe(100);
    expect(g.run("Score.best('medium')")).toBe(0);
    expect(g.run("Score.best('hard')")).toBe(0);
  });

  // localStorage throws outright in private windows and when site data is
  // blocked. High scores should fail quietly rather than break the game.
  it('survives localStorage throwing', () => {
    g.run('Score.reset(); Score.updateHeight(1000);');
    g.storage.throwOnAccess = true;

    expect(() => g.run("Score.best('easy')")).not.toThrow();
    expect(g.run("Score.best('easy')")).toBe(0);
    expect(() => g.run("Score.save('easy')")).not.toThrow();
    expect(g.run("Score.save('easy')")).toBe(false);
  });

  it('treats malformed stored values as no record', () => {
    g.storage._map.set('upupangel.highscore.easy', 'not-a-number');
    expect(g.run("Score.best('easy')")).toBe(0);
  });
});
