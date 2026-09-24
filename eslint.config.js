import globals from "globals";

// ---------------------------------------------------------------------------
// p5.js runs in global mode: every drawing function and constant is injected
// onto window rather than imported, so ESLint has to be told they exist. Only
// the ones this project actually uses are listed, so a misspelled p5 call is
// still reported.
// ---------------------------------------------------------------------------
const p5Globals = {
  // Lifecycle
  preload: "readonly", setup: "readonly", draw: "readonly",
  // Canvas and environment
  createCanvas: "readonly", width: "readonly", height: "readonly",
  frameCount: "readonly", frameRate: "readonly",
  windowWidth: "readonly", windowHeight: "readonly",
  pixelDensity: "readonly", displayDensity: "readonly",
  windowResized: "readonly",
  // Drawing
  background: "readonly", image: "readonly", rect: "readonly",
  circle: "readonly", ellipse: "readonly", triangle: "readonly",
  fill: "readonly", noFill: "readonly", stroke: "readonly", noStroke: "readonly",
  strokeWeight: "readonly",
  tint: "readonly", noTint: "readonly", push: "readonly", pop: "readonly",
  translate: "readonly", rotate: "readonly", constrain: "readonly",
  // Text
  text: "readonly", textAlign: "readonly", textSize: "readonly",
  textFont: "readonly", textWidth: "readonly",
  // Asset loading
  loadImage: "readonly", loadSound: "readonly", getAudioContext: "readonly",
  // Maths
  random: "readonly", abs: "readonly", min: "readonly", max: "readonly",
  sin: "readonly", cos: "readonly", map: "readonly", floor: "readonly",
  dist: "readonly",
  // Input
  mouseX: "readonly", mouseY: "readonly", keyCode: "readonly",
  keyIsDown: "readonly", mousePressed: "readonly", keyPressed: "readonly",
  keyReleased: "readonly",
  touches: "readonly", touchStarted: "readonly", touchEnded: "readonly",
  touchMoved: "readonly",
  // Constants
  CENTER: "readonly", LEFT: "readonly", RIGHT: "readonly",
  TOP: "readonly", BOTTOM: "readonly",
  LEFT_ARROW: "readonly", RIGHT_ARROW: "readonly", ENTER: "readonly",
};

// ---------------------------------------------------------------------------
// The project's own cross-file globals. Every file is loaded as a classic
// script sharing one global scope, so ESLint would otherwise treat every
// cross-file reference as undefined.
//
// This list is the allow-list of names that are shared on purpose: anything
// not in it is reported by no-undef, which is what catches a forgotten
// declaration turning into an accidental implicit global.
// ---------------------------------------------------------------------------
const projectGlobals = Object.fromEntries([
  // Classes
  "Candy", "Cloud", "Danger", "Halo", "LifeHeart", "Monster",
  "MovingCloud", "SpringCloud", "VanishingCloud", "FallingCloud",
  "Objects", "Plateform", "Player",
  // Game state
  "clouds", "objects", "hearts", "player", "plateform",
  "life", "candyCount", "gameScreen", "selectedDifficulty",
  // Layout constants
  "canvasWidth", "canvasHeight", "statusAreaHeight",
  "cloudWidth", "cloudHeight", "grassHeight", "firstLevelY",
  "movingDistance", "numClouds", "numCoinOrHeart",
  // Images
  "bgImg", "bgGame", "angelWords", "challengeWords",
  "cloudImg", "haloImg", "candyImg", "heartImg", "grassImg",
  "monsterLeftImg", "monsterRightImg", "dangerImg",
  "playerLeftImg", "playerRightImg",
  "simple", "simpleHover", "simpleBox",
  "medium", "mediumHover", "mediumBox",
  "hard", "hardHover", "hardBox",
  // Audio
  "bgMusic", "loseMusic", "jumpSound", "getCoinSound", "fireSound",
  // UI geometry and animation
  "titleY", "angle", "playX", "playY", "playWidth", "playHeight",
  "IgotitX", "IgotitY", "IgotitW", "IgotitH",
  "winOrLoseButtons", "winOrLoseLabels", "winOrLoseX", "winOrLoseY",
  "winOrLoseWidth", "winOrLoseHeight", "winOrLoseSpacing", "winOrLoseFlashTimer",
  // Scoring and touch controls
  "Score", "TouchControls", "scoreSaved", "isNewRecord",
  // Camera and rendering
  "cameraPending", "CAMERA_STEP_EASING", "CAMERA_FALL_EASING", "CAMERA_CEILING_MARGIN",
  "MAX_PIXEL_DENSITY", "updateCamera", "scheduleCameraStep", "applyPixelDensity",
  // Movement and jump feel
  "JUMP_TUNING", "MOVE_TUNING", "CLOUD_SPRITE_SCALE", "releaseJump", "keyReleased",
  // Cloud variants
  "CLOUD_MIX", "pickStaticCloudType", "canHoldItem",
  // Endless mode
  "Endless", "ENDLESS_TOGGLE", "isOverEndlessToggle", "drawEndlessToggle", "scoreKey",
  // Pause, mute, damage feedback, difficulty curve
  "paused", "muted", "ghostSound", "damageFlash", "shakeFrames",
  "DAMAGE_FLASH_FRAMES", "DAMAGE_SHAKE_FRAMES", "DAMAGE_SHAKE_PIXELS",
  "DIFFICULTY", "difficultyConfig", "allSounds", "applyMute", "toggleMute",
  "triggerDamageFeedback", "drawPauseOverlay",
  // Functions called across files
  "shiftScreen", "drawGame", "drawStartScreen", "drawInstructionScreen",
  "drawDifficultyScreen", "drawStatusArea", "drawWinOrLoseScreen",
  "drawWrappedText", "drawScorePanel",
  "isOverIgotit", "isOverPlay", "difficultyAt", "winOrLoseButtonAt",
  "handlePointerPress", "resumeAudio", "tryJump",
  "startNewGame", "restartGame", "resetGameData",
  "generateGameElements", "generateClouds", "nextCloudX", "generateHeart",
].map((name) => [name, "writable"]));

export default [
  {
    files: ["docs/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...p5Globals,
        ...projectGlobals,
      },
    },
    rules: {
      // Catches an undeclared variable becoming an implicit global.
      "no-undef": "error",

      // The allow-list above makes real declarations look like redeclarations
      // of a builtin. Redeclarations within a file are still reported.
      "no-redeclare": ["error", { builtinGlobals: false }],

      // Locals only. With one shared global scope, a function called from
      // another file always looks unused in its own, so vars: "all" would be
      // entirely false positives. Switching to ES modules would allow it.
      "no-unused-vars": ["warn", { vars: "local", args: "none" }],

      // General correctness
      "no-shadow": "warn",
      "no-dupe-keys": "error",
      "no-fallthrough": "error",
      "no-unreachable": "error",
      "no-self-compare": "error",
      "no-constant-condition": "warn",
      eqeqeq: ["warn", "smart"],

      // Style: keep the existing conventions rather than forcing a rewrite.
      "no-var": "warn",
      "prefer-const": "off",
    },
  },
];
