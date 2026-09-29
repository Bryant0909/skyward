/**
 * Loads the game for testing.
 *
 * The game is a set of classic <script> files that share a global scope and
 * export nothing. To test it without changing a line of production code, this
 * builds a node:vm context, fills it with a p5 stub, and runs the source files
 * in the same order a browser would.
 *
 * State is read back through run(), because top-level let/const are lexical
 * declarations and never become properties of the global object — exactly as
 * in the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'docs', 'src');

/** Same order as docs/index.html; base classes before their subclasses. */
const SOURCE_FILES = [
  'classes/player.js',
  'classes/cloud.js',
  'classes/objects.js',
  'classes/lifeHeart.js',
  'classes/movingCloud.js',
  'classes/springCloud.js',
  'classes/vanishingCloud.js',
  'classes/fallingCloud.js',
  'classes/danger.js',
  'classes/halo.js',
  'classes/monster.js',
  'classes/candy.js',
  'classes/plateform.js',
  'score.js',
  'controls.js',
  'endless.js',
  'sketch.js',
];

/** Reproducible randomness, so tests that depend on random() do not flake. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** localStorage stand-in, switchable into a mode that throws on every access. */
export function createFakeStorage() {
  const map = new Map();
  const storage = {
    throwOnAccess: false,
    getItem(k) {
      if (storage.throwOnAccess) throw new Error('SecurityError');
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      if (storage.throwOnAccess) throw new Error('QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
    _map: map,
  };
  return storage;
}

function createP5Stub(rng) {
  const noop = () => {};
  const soundStub = () => ({
    _playing: false,
    _volume: 1,
    _plays: 0,
    play() { this._playing = true; this._plays++; },
    loop() { this._playing = true; },
    stop() { this._playing = false; },
    isPlaying() { return this._playing; },
    setVolume(v) { this._volume = v; },
  });

  return {
    // Canvas and environment
    createCanvas: noop,
    width: 800,
    height: 600,
    windowWidth: 1200,
    windowHeight: 900,
    frameCount: 0,
    pixelDensity: () => 1,
    displayDensity: () => 1,

    // Drawing: tests do not inspect pixels, so these are all no-ops.
    background: noop, image: noop, rect: noop, circle: noop,
    ellipse: noop, triangle: noop, fill: noop, noFill: noop,
    stroke: noop, noStroke: noop, strokeWeight: noop,
    tint: noop, noTint: noop, push: noop, pop: noop, translate: noop,
    rotate: noop,
    text: noop, textAlign: noop, textSize: noop, textFont: noop,
    textWidth: (s) => String(s).length * 8,

    // Maths: real implementations, since they are part of what is under test.
    abs: Math.abs, min: Math.min, max: Math.max,
    sin: Math.sin, cos: Math.cos, floor: Math.floor,
    map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    random: (a, b) => {
      if (Array.isArray(a)) return a[Math.floor(rng() * a.length)];
      if (a === undefined) return rng();
      if (b === undefined) return rng() * a;
      return a + rng() * (b - a);
    },

    // Assets
    loadImage: () => ({ width: 64, height: 64 }),
    loadSound: soundStub,
    getAudioContext: () => ({ state: 'running', resume: noop }),

    // Input
    mouseX: 0, mouseY: 0, keyCode: 0,
    keyIsDown: () => false,
    touches: [],

    // Constants
    CENTER: 'center', LEFT: 'left', RIGHT: 'right',
    TOP: 'top', BOTTOM: 'bottom',
    LEFT_ARROW: 37, RIGHT_ARROW: 39, ENTER: 13,
  };
}

/**
 * Loads the game and returns a handle to it.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.seed]            random seed
 * @param {number}  [opts.maxTouchPoints]  greater than 0 enables TouchControls
 * @param {boolean} [opts.runSetup]        run preload()/setup(), default true
 */
export function loadGame(opts = {}) {
  const { seed = 12345, maxTouchPoints = 0, runSetup = true } = opts;

  const storage = createFakeStorage();
  const ctx = {
    ...createP5Stub(mulberry32(seed)),
    console,
    localStorage: storage,
    navigator: { maxTouchPoints },
    requestAnimationFrame: () => 0,
    setTimeout,
    performance,
  };

  vm.createContext(ctx);
  // window === global, as in a browser; sketch.js assigns window.mousePressed.
  vm.runInContext('var window = globalThis;', ctx);

  for (const rel of SOURCE_FILES) {
    const file = path.join(SRC, rel);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: rel });
  }

  const api = {
    ctx,
    storage,
    /** Evaluates code inside the game's global scope and returns the result. */
    run: (code) => vm.runInContext(code, ctx),
  };

  if (runSetup) {
    api.run('preload(); setup();');
  }
  return api;
}
