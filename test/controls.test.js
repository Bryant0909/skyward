import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

describe('on-screen touch controls', () => {
  it('stay disabled without touch support', () => {
    const g = loadGame({ maxTouchPoints: 0 });
    expect(g.run('TouchControls.enabled')).toBe(false);
    expect(g.run('TouchControls.at(72, 528)')).toBe(null);
  });

  it('enable on a touch device', () => {
    const g = loadGame({ maxTouchPoints: 5 });
    expect(g.run('TouchControls.enabled')).toBe(true);
  });

  it('map points to the right button', () => {
    const g = loadGame({ maxTouchPoints: 5 });
    expect(g.run('TouchControls.at(72, 528)')).toBe('left');
    expect(g.run('TouchControls.at(170, 528)')).toBe('right');
    expect(g.run('TouchControls.at(718, 522)')).toBe('jump');
    expect(g.run('TouchControls.at(400, 300)')).toBe(null);
  });

  it('use a circular hit area', () => {
    const g = loadGame({ maxTouchPoints: 5 });
    // left button: centre (72, 528), radius 38
    expect(g.run('TouchControls.at(72 + 30, 528)')).toBe('left');
    expect(g.run('TouchControls.at(72 + 45, 528)')).not.toBe('left');
  });

  it('report held state across all current touches', () => {
    const g = loadGame({ maxTouchPoints: 5 });
    expect(g.run("TouchControls.isHeld('left')")).toBe(false);

    g.ctx.touches = [{ x: 72, y: 528 }];
    expect(g.run("TouchControls.isHeld('left')")).toBe(true);
    expect(g.run("TouchControls.isHeld('right')")).toBe(false);

    g.ctx.touches = [{ x: 72, y: 528 }, { x: 718, y: 522 }];
    expect(g.run("TouchControls.isHeld('left')")).toBe(true);
    expect(g.run("TouchControls.isHeld('jump')")).toBe(true);

    g.ctx.touches = [];
    expect(g.run("TouchControls.isHeld('left')")).toBe(false);
  });

  it('do not overlap each other', () => {
    const g = loadGame({ maxTouchPoints: 5 });
    const ok = g.run(`
      const names = Object.keys(TouchControls.BUTTONS);
      let disjoint = true;
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = TouchControls.BUTTONS[names[i]];
          const b = TouchControls.BUTTONS[names[j]];
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) disjoint = false;
        }
      }
      disjoint
    `);
    expect(ok).toBe(true);
  });
});
