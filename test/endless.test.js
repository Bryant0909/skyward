import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

const iife = (body) => `(() => {\n${body}\n})()`;

describe('endless mode', () => {
  let g;
  beforeEach(() => { g = loadGame(); });

  it('is off by default', () => {
    expect(g.run('Endless.enabled')).toBe(false);
  });

  it('leaves the halo in place for normal runs', () => {
    g.run("selectedDifficulty='easy'; startNewGame();");
    expect(g.run('objects.some(o => o instanceof Halo)')).toBe(true);
  });

  it('spawns no halo', () => {
    g.run("Endless.enabled = true; selectedDifficulty='easy'; startNewGame();");
    expect(g.run('objects.some(o => o instanceof Halo)')).toBe(false);
  });

  it('recycles off-screen clouds to the top', () => {
    g.run("Endless.enabled = true; selectedDifficulty='medium'; startNewGame();");
    const r = g.run(iife(`
      const before = clouds.length;
      const topBefore = Math.min(...clouds.map(c => c.y));
      clouds[10].y = canvasHeight + 400;
      const recycledRef = clouds[10];
      Endless.recycle();
      return JSON.stringify({
        countUnchanged: clouds.length === before,
        replaced: clouds[10] !== recycledRef,
        newY: clouds[10].y,
        topBefore,
        objectMatchesCloud: objects[10].cloud === clouds[10],
      });
    `));
    const { countUnchanged, replaced, newY, topBefore, objectMatchesCloud } = JSON.parse(r);
    expect(countUnchanged).toBe(true);
    expect(replaced).toBe(true);
    expect(newY).toBeLessThan(topBefore);        // placed above the old highest
    expect(objectMatchesCloud).toBe(true);       // its object was replaced too
  });

  it('leaves visible clouds alone', () => {
    g.run("Endless.enabled = true; selectedDifficulty='medium'; startNewGame();");
    const same = g.run(iife(`
      const snapshot = clouds.slice();
      Endless.recycle();
      return clouds.every((c, i) => c === snapshot[i]);
    `));
    expect(same).toBe(true);
  });

  it('does nothing while disabled', () => {
    g.run("selectedDifficulty='medium'; startNewGame();");
    const same = g.run(iife(`
      clouds[5].y = canvasHeight + 500;
      const ref = clouds[5];
      Endless.recycle();
      return clouds[5] === ref;
    `));
    expect(same).toBe(true);
  });

  it('ramps difficulty with altitude and caps it', () => {
    g.run('Score.reset();');
    expect(g.run('Endless.progress()')).toBe(0);
    g.run('Score.updateHeight(Endless.RAMP_HEIGHT / 2);');
    expect(g.run('Endless.progress()')).toBeCloseTo(0.5, 5);
    g.run('Score.updateHeight(Endless.RAMP_HEIGHT * 10);');
    expect(g.run('Endless.progress()')).toBe(1);
  });

  it('spawns more special clouds higher up', () => {
    function specialRatio(height) {
      const gg = loadGame({ seed: 4242 });
      gg.run("Endless.enabled = true; selectedDifficulty='hard'; startNewGame();");
      gg.run(`Score.reset(); Score.updateHeight(${height});`);
      return gg.run(iife(`
        let special = 0;
        const N = 400;
        for (let i = 0; i < N; i++) {
          const c = Endless.spawnCloud(0);
          if (c instanceof VanishingCloud || c instanceof FallingCloud) special++;
        }
        return special / N;
      `));
    }
    expect(specialRatio(0)).toBeLessThan(specialRatio(6000));
  });

  it('tracks high scores separately from normal runs', () => {
    g.run("selectedDifficulty='easy';");
    expect(g.run('scoreKey()')).toBe('easy');
    g.run('Endless.enabled = true;');
    expect(g.run('scoreKey()')).toBe('easy-endless');

    g.run('Score.reset(); Score.updateHeight(1000); Score.save(scoreKey());');
    expect(g.run("Score.best('easy-endless')")).toBe(100);
    expect(g.run("Score.best('easy')")).toBe(0);
  });

  it('removes the camera top limit', () => {
    g.run("Endless.enabled = true; selectedDifficulty='easy'; startNewGame();");
    const pending = g.run(iife(`
      // In a normal run this would stop the camera scrolling any further up.
      clouds[clouds.length - 1].y = canvasHeight + 10;
      player.y = canvasHeight / 2 - 60;
      cameraPending = 0;
      scheduleCameraStep(player);
      return cameraPending;
    `));
    expect(pending).toBeCloseTo(60, 5);
  });
});

describe('difficulty curve', () => {
  it('uses different terrain parameters per difficulty', () => {
    const g = loadGame();
    const cfg = JSON.parse(g.run('JSON.stringify(DIFFICULTY)'));
    expect(cfg.easy.movingRatio).toBeLessThan(cfg.hard.movingRatio);
    expect(cfg.easy.movingSpeed).toBeLessThan(cfg.hard.movingSpeed);
    expect(cfg.easy.gapMax).toBeLessThan(cfg.hard.gapMax);
  });

  it('spawns proportionally more moving clouds on hard', () => {
    function movingRatio(difficulty) {
      let moving = 0, total = 0;
      for (const seed of [3, 17, 256, 4096]) {
        const g = loadGame({ seed });
        g.run(`selectedDifficulty='${difficulty}'; startNewGame();`);
        moving += g.run('clouds.filter(c => c instanceof MovingCloud).length');
        total += g.run('clouds.length');
      }
      return moving / total;
    }
    expect(movingRatio('easy')).toBeLessThan(movingRatio('hard'));
  });

  it('scales moving cloud speed with difficulty', () => {
    function avgSpeed(difficulty) {
      const g = loadGame({ seed: 777 });
      g.run(`selectedDifficulty='${difficulty}'; startNewGame();`);
      return g.run(`(() => {
        const m = clouds.filter(c => c instanceof MovingCloud);
        return m.reduce((s, c) => s + c.speed, 0) / m.length;
      })()`);
    }
    expect(avgSpeed('easy')).toBeLessThan(avgSpeed('hard'));
  });

  // A full-power jump reaches about 140px; a wider gap would be a dead end.
  it('keeps every level gap jumpable', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const g = loadGame({ seed: 31337 });
      g.run(`selectedDifficulty='${difficulty}'; startNewGame();`);
      // generateClouds() skips clouds that would overlap, so array indices do
      // not map to levels. Distinct y values are used as levels instead.
      const maxGap = g.run(`(() => {
        const levels = [...new Set(clouds.map(c => Math.round(c.y)))].sort((a, b) => b - a);
        let worst = 0;
        for (let i = 1; i < levels.length; i++) {
          worst = Math.max(worst, levels[i - 1] - levels[i]);
        }
        return worst;
      })()`);
      expect(maxGap).toBeLessThanOrEqual(100);
    }
  });
});
