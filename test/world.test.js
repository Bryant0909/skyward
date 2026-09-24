import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame } from './harness.js';

describe('level generation', () => {
  let g;
  beforeEach(() => { g = loadGame(); });

  it('puts the halo on the last cloud', () => {
    g.run("selectedDifficulty='easy'; startNewGame();");
    expect(g.run('objects[objects.length - 1] instanceof Halo')).toBe(true);
    expect(g.run('objects.length')).toBe(g.run('clouds.length'));
  });

  it('builds upward, so higher clouds have a smaller y', () => {
    g.run("selectedDifficulty='easy'; startNewGame();");
    const ok = g.run(`
      let monotonic = true;
      for (let i = 3; i < clouds.length; i += 3) {
        if (clouds[i].y >= clouds[i - 3].y) { monotonic = false; break; }
      }
      monotonic
    `);
    expect(ok).toBe(true);
  });

  it('keeps clouds within the canvas', () => {
    g.run("selectedDifficulty='easy'; startNewGame();");
    const ok = g.run(`
      clouds.every(c => c.x - c.w / 2 >= -c.w && c.x + c.w / 2 <= canvasWidth + c.w)
    `);
    expect(ok).toBe(true);
  });

  it('spawns no hazards on easy', () => {
    g.run("selectedDifficulty='easy'; startNewGame();");
    expect(g.run('objects.filter(o => o instanceof Danger).length')).toBe(0);
  });

  it('spawns hellfire but no ghosts on medium', () => {
    g.run("selectedDifficulty='medium'; startNewGame();");
    expect(g.run('objects.filter(o => o instanceof Monster).length')).toBe(0);
    expect(g.run('objects.filter(o => o instanceof Danger).length')).toBeGreaterThan(0);
  });

  it('spawns both on hard', () => {
    g.run("selectedDifficulty='hard'; startNewGame();");
    expect(g.run('objects.filter(o => o instanceof Monster).length')).toBeGreaterThan(0);
    expect(g.run('objects.filter(o => o instanceof Danger && !(o instanceof Monster)).length'))
      .toBeGreaterThan(0);
  });

  /**
   * What matters is not the coordinates but that an object on a cloud can be
   * reached by a player standing on it.
   *
   * move() is called first: the Objects constructor computes y from this.size,
   * but subclasses override size after super() runs, so a freshly constructed
   * object is briefly positioned using the base size. move() recomputes it on
   * the first frame of the game.
   */
  it('places every object within reach of its cloud', () => {
    g.run("selectedDifficulty='hard'; startNewGame();");
    const r = g.run(`(() => {
      for (const o of objects) o.move();
      const misses = [];
      for (const o of objects) {
        const cl = o.cloud;
        player.x = o.x + o.size / 2 - player.size / 2;
        player.prevY = player.y = cl.y - cl.h / 2 - player.size / 2;
        if (!player.collidesWith(o)) misses.push(o.constructor.name);
      }
      return JSON.stringify({ total: objects.length, misses });
    })()`);
    const { total, misses } = JSON.parse(r);
    expect(total).toBeGreaterThan(50);
    expect(misses).toEqual([]);
  });
});

describe('game reset', () => {
  let g;
  beforeEach(() => { g = loadGame(); });

  // Regression: generateGameElements() used to call generateHeart() as well as
  // its caller, producing six hearts per run instead of three.
  it('creates exactly three hearts', () => {
    g.run("selectedDifficulty='easy'; startNewGame();");
    expect(g.run('hearts.length')).toBe(3);
  });

  it('does not accumulate hearts across restarts', () => {
    g.run("selectedDifficulty='easy'; startNewGame(); restartGame(); restartGame(); restartGame();");
    expect(g.run('hearts.length')).toBe(3);
  });

  it('clears lives, candy and score on Play Again', () => {
    g.run(`
      selectedDifficulty='easy'; startNewGame();
      life = 1; candyCount = 2;
      Score.updateHeight(3000); Score.addCandy();
      restartGame();
    `);
    expect(g.run('life')).toBe(3);
    expect(g.run('candyCount')).toBe(0);
    expect(g.run('Score.current()')).toBe(0);
    expect(g.run('gameScreen')).toBe('game');
  });

  it('empties the world on resetGameData', () => {
    g.run("selectedDifficulty='easy'; startNewGame(); resetGameData();");
    expect(g.run('clouds.length')).toBe(0);
    expect(g.run('objects.length')).toBe(0);
    expect(g.run('hearts.length')).toBe(0);
    expect(g.run('player')).toBe(null);
  });
});

describe('screen flow', () => {
  let g;
  beforeEach(() => { g = loadGame(); });

  // Regression: Enter on the start screen used to set gameScreen to "game"
  // without initialising the world, so draw() threw on every frame afterwards.
  it('moves from start to instructions without crashing', () => {
    g.run('keyCode = ENTER; keyPressed();');
    expect(g.run('gameScreen')).toBe('instruction');
    expect(() => g.run('draw();')).not.toThrow();
  });

  it('moves from instructions to difficulty select', () => {
    g.run('keyCode = ENTER; keyPressed(); keyPressed();');
    expect(g.run('gameScreen')).toBe('difficulty');
  });

  it('matches difficulty hit areas to the drawn buttons', () => {
    // Images are drawn at y = 50 / 200 / 350 with height 350, so their centres
    // fall at 225 / 375 / 530.
    expect(g.run('difficultyAt(400, 225)')).toBe('easy');
    expect(g.run('difficultyAt(400, 375)')).toBe('medium');
    expect(g.run('difficultyAt(400, 530)')).toBe('hard');
    expect(g.run('difficultyAt(400, 100)')).toBe(null);
    expect(g.run('difficultyAt(50, 225)')).toBe(null);
  });

  // Regression: mousePressed() ended in an unconditional else branch that read
  // btn.hover, a flag only updated on the end screen. Any click during play
  // triggered whichever end-screen button was last hovered.
  it('ignores menu clicks during play', () => {
    g.run(`
      selectedDifficulty='easy'; startNewGame();
      winOrLoseButtons.forEach(b => b.hover = true);
      player.y = 120;
      handlePointerPress(400, 300);
    `);
    expect(g.run('player.y')).toBe(120);
    expect(g.run('gameScreen')).toBe('game');
  });

  it('resolves end-screen buttons by position, not the hover flag', () => {
    g.run("selectedDifficulty='easy'; startNewGame(); gameScreen='gameOver';");
    g.run('winOrLoseButtons.forEach(b => b.hover = false);');
    const btn = g.run('winOrLoseButtonAt(winOrLoseButtons[1].x, winOrLoseButtons[1].y).label');
    expect(btn).toBe('Settings');
    expect(g.run('winOrLoseButtonAt(10, 10)')).toBe(null);
  });
});
