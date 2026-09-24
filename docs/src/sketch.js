// World state
let clouds = [], objects = [], hearts = [];
let player, plateform;
let numClouds = 100;
let canvasWidth = 800, canvasHeight = 600, statusAreaHeight = 50;
let cloudWidth = 100, cloudHeight = 20, firstLevelY, grassHeight = 30;
let movingDistance = canvasHeight / 8;
let numCoinOrHeart = 3;
let life = 3, candyCount = 0;

// Images
let cloudImg, haloImg, monsterLeftImg, monsterRightImg, dangerImg, playerLeftImg, playerRightImg, grassImg;
let candyImg, heartImg;
let bgImg, bgGame, angelWords, challengeWords;
let simple, simpleHover, medium, mediumHover, hard, hardHover;
let simpleBox, mediumBox, hardBox;

// Menu geometry and screen state
let titleY = 100, angle = 0;
let playX, playY, playWidth = 200, playHeight = 80;
let gameScreen = "start";
let IgotitX, IgotitY, IgotitW = 160, IgotitH = 50;
let selectedDifficulty = "easy";

// Game coordinates are fixed at 800x600 and CSS scales the canvas to fill the
// window, so the backing store has to grow with it or everything is upscaled
// from an 800px bitmap. The cap keeps the buffer reasonable on large displays.
const MAX_PIXEL_DENSITY = 4;

// Share of static clouds replaced by a special type, per difficulty. Moving
// clouds are chosen separately in generateClouds() because their placement
// needs extra horizontal slack. The remainder are plain clouds.
const CLOUD_MIX = {
  easy:   { spring: 0.12, vanishing: 0,    falling: 0 },
  medium: { spring: 0.12, vanishing: 0.18, falling: 0 },
  hard:   { spring: 0.10, vanishing: 0.22, falling: 0.12 },
};

// Camera. Positive shift moves the world down, which reads as climbing.
let cameraPending = 0;
const CAMERA_STEP_EASING = 0.1;
const CAMERA_FALL_EASING = 0.1;

// The player is never allowed above this line. A normal jump peaks well below
// it; a spring jump would otherwise carry them off the top of the screen.
const CAMERA_CEILING_MARGIN = 40;

// End screens redraw every frame, so settling is guarded by a flag.
let scoreSaved = false;
let isNewRecord = false;

// Sounds
let bgMusic, loseMusic, jumpSound, getCoinSound, fireSound, ghostSound;

let paused = false;
let muted = false;

// Damage feedback: remaining frames of red flash and screen shake.
let damageFlash = 0;
let shakeFrames = 0;
const DAMAGE_FLASH_FRAMES = 22;
const DAMAGE_SHAKE_FRAMES = 12;
const DAMAGE_SHAKE_PIXELS = 6;

// Terrain parameters per difficulty, so the three modes differ in layout and
// not only in how many hazards spawn. Level gaps stay under 95px because a
// full-power jump reaches about 140px and a tapped one about 60px.
const DIFFICULTY = {
  easy:   { movingRatio: 0.35, movingSpeed: 0.80, gapMin: 55, gapMax: 80 },
  medium: { movingRatio: 0.50, movingSpeed: 1.00, gapMin: 60, gapMax: 88 },
  hard:   { movingRatio: 0.62, movingSpeed: 1.35, gapMin: 65, gapMax: 95 },
};

function difficultyConfig() {
  return DIFFICULTY[selectedDifficulty] || DIFFICULTY.easy;
}

/** High-score storage key. Endless runs are tracked separately. */
function scoreKey() {
  return Endless.enabled ? selectedDifficulty + '-endless' : selectedDifficulty;
}

// End screen buttons
let winOrLoseButtons = [];
let winOrLoseLabels = ["Play Again", "Settings", "Exit Game"];
let winOrLoseX, winOrLoseY;
let winOrLoseWidth = 200, winOrLoseHeight = 50, winOrLoseSpacing = 15, winOrLoseFlashTimer = 0;

// p5 waits for everything loaded here before calling setup() or draw().
function preload() {
  bgImg           = loadImage('assets/bg.png');
  angelWords      = loadImage('assets/upup.png');
  bgGame          = loadImage('assets/gameBackground.jpg');
  grassImg        = loadImage('assets/grass1.png');
  cloudImg        = loadImage('assets/cloud2.png');
  candyImg        = loadImage('assets/candy.png');
  monsterLeftImg  = loadImage('assets/ghost2.gif');
  monsterRightImg = loadImage('assets/ghost1.gif');
  dangerImg       = loadImage('assets/ghost-fire.gif');
  heartImg        = loadImage('assets/blood.png');
  haloImg         = loadImage('assets/halo.png');
  playerLeftImg   = loadImage('assets/angel-2.gif');
  playerRightImg  = loadImage('assets/angel-1.gif');

  simple      = loadImage('assets/simple1.PNG');
  simpleHover = loadImage('assets/simple2.PNG');
  simpleBox   = loadImage('assets/simpleBox.PNG');
  medium      = loadImage('assets/medium1.png');
  mediumHover = loadImage('assets/medium2.png');
  mediumBox   = loadImage('assets/mediumBox.png');
  hard        = loadImage('assets/hard1.png');
  hardHover   = loadImage('assets/hard2.png');
  hardBox     = loadImage('assets/hardBox.png');

  bgMusic      = loadSound('assets/sound/bgm.mp3');
  loseMusic    = loadSound('assets/sound/fail.mp3');
  jumpSound    = loadSound('assets/sound/jump.mp3');
  getCoinSound = loadSound('assets/sound/coin.mp3');
  fireSound    = loadSound('assets/sound/fire.mp3');
  ghostSound   = loadSound('assets/sound/ghost.mp3');
}

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  applyPixelDensity();
  TouchControls.detect();

  playX = width / 2;
  playY = height - 150;

  textAlign(CENTER, CENTER);
  textSize(24);
  textFont("Comic Sans MS");

  // Centre-aligned, matching how drawInstructionScreen() draws it, so the
  // clickable area and the visible label are the same rectangle.
  IgotitX = width - 70;
  IgotitY = height - 30;
  IgotitW = 120;
  IgotitH = 40;

  // Sits low enough to leave room for the score panel above it.
  winOrLoseX = width / 2;
  winOrLoseY = height / 2 + 60;

  for (let i = 0; i < winOrLoseLabels.length; i++) {
    winOrLoseButtons.push({
      label: winOrLoseLabels[i],
      x: winOrLoseX,
      y: winOrLoseY + i * (winOrLoseHeight + winOrLoseSpacing),
      w: winOrLoseWidth,
      h: winOrLoseHeight,
      hover: false
    });
  }
}

/** Matches the backing store to the size the canvas is actually displayed at. */
function applyPixelDensity() {
  const scale = Math.min(windowWidth / canvasWidth, windowHeight / canvasHeight);
  const target = Math.max(1, scale) * displayDensity();
  pixelDensity(Math.min(MAX_PIXEL_DENSITY, target));
}

/** Layout is handled by CSS; only the resolution needs recomputing. */
function windowResized() {
  applyPixelDensity();
}

function draw() {
  background(255);

  if (gameScreen === "start") {
    drawStartScreen();
  } else if (gameScreen === "instruction") {
    drawInstructionScreen();
  } else if (gameScreen === "difficulty") {
    drawDifficultyScreen();
  } else if (gameScreen === "game")  {
    drawGame();
  } else {
    // Settled once, on the frame the end screen is entered. Doing it here
    // rather than at each trigger keeps Player unaware of the score system.
    if (!scoreSaved) {
      Score.won = (gameScreen === "youWin");
      isNewRecord = Score.save(scoreKey());
      scoreSaved = true;
    }
    drawWinOrLoseScreen();
  }
}

function drawStartScreen() {
  background(bgImg);

  let bounce = sin(angle) * 20;
  angle += 0.05;
  image(angelWords, width / 3- angelWords.width / 3 , titleY/3+ bounce-60, angelWords.width / 0.7 , angelWords.height / 0.7);

  let isPlayHover = mouseX > playX - playWidth / 2 && mouseX < playX + playWidth / 2 &&mouseY > playY - playHeight / 2 && mouseY < playY + playHeight / 2;

  fill(isPlayHover ? '#DFA0B2' : '#0BCBB8');
  noStroke();
  rect(playX - playWidth / 2+7, playY - playHeight / 2+5, playWidth-20, playHeight-20, 10);
  fill(255);
  textSize(32);
  textAlign(CENTER, CENTER);
  text("PLAY", playX, playY);
}

function drawInstructionScreen() {
  background(bgGame);
  fill(0);

  textSize(50);
  text("Instructions", width / 2, 60);

  textSize(24);
  let textX = width / 2 - 50;

  fill(255, 150, 0);
  text("Candy - ", 150, 120);
  fill(0, 0, 0);
  text("Collect three candies to gain an extra life!", textX + 85, 120);

  fill(255, 150, 0);
  text("Ghost - ", 150, 170);
  fill(0, 0, 0);
  text("If you touch a ghost, you will lose one life!", textX + 90, 170);

  fill(255, 150, 0);
  text("Hellfire - ", 160, 220);
  fill(0, 0, 0);
  drawWrappedText("If you touch the hellfire, you will lose one life!", textX + 130, 220, 600);

  fill(255, 150, 0);
  text("Heart - ", 150, 270);
  fill(0, 0, 0);
  drawWrappedText("Represents your life. You start with three lives. If you lose them all, the game is over.", textX + 90, 270, 500);

  fill(255, 150, 0);
  text("Halo - ", 145, 350);
  fill(0, 0, 0);
  drawWrappedText("If you touch the halo, you will fly to heaven and win the game!", textX + 110, 350, 540);

  fill(255, 150, 0);
  text("Note1 - ", 150, 420);
  fill(0, 0, 0);
  drawWrappedText("If you fall to the ground, you will lose one life!", textX + 110, 420, 610);

  fill(255, 150, 0);
  text("Note2 - ", 150, 470);
  fill(0, 0, 0);
  drawWrappedText("You can only have up to three lives. If you already have three, collecting more candies won’t give you any extras!", textX + 130, 470, 580);

  image(candyImg, width / 2 - 360, 95, 60, 60);
  image(monsterRightImg, width / 2 - 350, 150, 35, 45);
  image(dangerImg, width / 2 - 345, 205, 26, 30);
  image(heartImg, width / 2 - 360, 245, 55, 55);
  image(haloImg, width / 2 - 350, 330, 40, 40);

  textSize(24);
  textAlign(CENTER, CENTER);
  fill(isOverIgotit() ? "rgb(255, 150, 0)" : "#0662AC");
  text("I got it →", IgotitX, IgotitY);
}

/** Shared by the hover styling and the click handler. */
function isOverIgotit(px = mouseX, py = mouseY) {
  return px > IgotitX - IgotitW / 2 && px < IgotitX + IgotitW / 2 &&
         py > IgotitY - IgotitH / 2 && py < IgotitY + IgotitH / 2;
}

function drawWrappedText(txt, x, y, maxWidth) {
  let words = txt.split(" ");
  let line = "";
  let lineHeight = 30;

  for (let i = 0; i < words.length; i++) {
    let testLine = line + words[i] + " ";
    if (textWidth(testLine) > maxWidth) {
      text(line, x, y);
      line = words[i] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  text(line, x, y);
}

window.drawDifficultyScreen = function() {
  background(bgGame);

  fill("#0662AC");
  textSize(36);
  textFont("Comic Sans MS");
  textAlign(LEFT, TOP);
  text("Select your challenge !", 50, 50);

  let buttonWidth = 400;
  let buttonHeight = 350;

  let isSimpleHover = mouseX > 190 && mouseX < 190 + buttonWidth && mouseY > 200 && mouseY < 270;
  let isMediumHover = mouseX > 190 && mouseX < 190 + buttonWidth && mouseY > 350 && mouseY < 420 ;
  let isHardHover = mouseX > 190 && mouseX < 190 + buttonWidth && mouseY > 500 && mouseY < 570;

  // Hovering a difficulty shows its description card.
  image(isSimpleHover ? simpleHover : simple, 190, 50, buttonWidth, buttonHeight);
  if (isSimpleHover && simpleBox) {
    let boxWidth = simpleBox.width/1.2 ;
    let boxHeight = simpleBox.height/1.2 ;
    let boxX = 190 + buttonWidth-150 ;
    let boxY = -100;
    image(simpleBox, boxX, boxY, boxWidth, boxHeight);
  }

  image(isMediumHover ? mediumHover : medium, 190, 200, buttonWidth, buttonHeight);
  if (isMediumHover && mediumBox) {
    let boxWidth = mediumBox.width / 1.2;
    let boxHeight = mediumBox.height / 1.2;
    let boxX = 190 + buttonWidth-150;
    let boxY = 50;
    image(mediumBox, boxX, boxY, boxWidth, boxHeight);
  }

  image(isHardHover ? hardHover : hard, 190, 350, buttonWidth-2, buttonHeight+10);

  drawEndlessToggle();

  if (isHardHover && hardBox) {
    let boxWidth = hardBox.width / 1.2;
    let boxHeight = hardBox.height / 1.2;
    let boxX = 190 + buttonWidth-150;
    let boxY = 200;
    image(hardBox, boxX, boxY, boxWidth, boxHeight);
  }
};

const ENDLESS_TOGGLE = { x: 640, y: 62, w: 220, h: 44 };

function isOverEndlessToggle(px = mouseX, py = mouseY) {
  return px > ENDLESS_TOGGLE.x - ENDLESS_TOGGLE.w / 2 &&
         px < ENDLESS_TOGGLE.x + ENDLESS_TOGGLE.w / 2 &&
         py > ENDLESS_TOGGLE.y - ENDLESS_TOGGLE.h / 2 &&
         py < ENDLESS_TOGGLE.y + ENDLESS_TOGGLE.h / 2;
}

function drawEndlessToggle() {
  const hover = isOverEndlessToggle();
  push();
  noStroke();
  fill(Endless.enabled ? '#0BCBB8' : (hover ? '#C9D6DE' : '#E3EAEF'));
  rect(ENDLESS_TOGGLE.x - ENDLESS_TOGGLE.w / 2, ENDLESS_TOGGLE.y - ENDLESS_TOGGLE.h / 2,
       ENDLESS_TOGGLE.w, ENDLESS_TOGGLE.h, 22);
  fill(Endless.enabled ? 255 : 90);
  textAlign(CENTER, CENTER);
  textSize(19);
  text("ENDLESS  " + (Endless.enabled ? "ON" : "OFF"), ENDLESS_TOGGLE.x, ENDLESS_TOGGLE.y);
  pop();
}

/**
 * Scrolls the world. Only clouds and the ground move; objects are bound to
 * their cloud and recompute their own position every frame.
 */
function shiftScreen(shiftAmount) {
  plateform.y += shiftAmount;
  plateform.y = plateform.y < canvasHeight ? canvasHeight : plateform.y;

  for (let cloud of clouds) {
    cloud.y += shiftAmount;
  }
}

/**
 * The camera does not follow while the player rises; it catches up only after
 * they land on a higher platform. Falling switches to continuous following, and
 * a ceiling forces it to follow when a jump would go off-screen.
 */
function updateCamera(p) {
  const restY = canvasHeight / 2;

  // Hard clamp, not eased: easing would let the player cross the line first.
  const ceilingY = statusAreaHeight + CAMERA_CEILING_MARGIN;
  if (p.y < ceilingY) {
    const shift = ceilingY - p.y;
    shiftScreen(shift);
    p.y += shift;
    cameraPending = 0;
    return;
  }

  // Falling, with room left to scroll back down.
  if (p.y > restY && plateform.y > canvasHeight) {
    cameraPending = 0;
    const shift = (restY - p.y) * CAMERA_FALL_EASING;
    shiftScreen(shift);
    p.y += shift;
    return;
  }

  // Rising: apply whatever step was scheduled on landing, nothing more.
  if (cameraPending !== 0) {
    let step = cameraPending * CAMERA_STEP_EASING;
    if (abs(step) < 0.5) {
      step = cameraPending;
    }
    shiftScreen(step);
    p.y += step;
    cameraPending -= step;
  }
}

/** Called on landing. Schedules a camera step if the new footing is high enough. */
function scheduleCameraStep(p) {
  const restY = canvasHeight / 2;
  // Endless mode has no top, so the limit does not apply there.
  const reachedTop = !Endless.enabled && clouds.length > 0 &&
                     clouds[clouds.length - 1].y >= canvasHeight;
  if (p.y < restY && !reachedTop) {
    cameraPending = restY - p.y;
  }
}

function drawGame() {
  background(bgGame);

  // Shake offsets the world only; the status bar has to stay readable.
  push();
  if (shakeFrames > 0) {
    const amount = DAMAGE_SHAKE_PIXELS * (shakeFrames / DAMAGE_SHAKE_FRAMES);
    translate(random(-amount, amount), random(-amount, amount));
  }

  plateform.show();
  for (let cloud of clouds) {
    cloud.show();
  }
  for (let obj of objects) {
    obj.show();
  }
  player.show();
  pop();

  if (!paused) {
    for (let cloud of clouds) {
      cloud.move();
    }
    for (let obj of objects) {
      obj.move();
    }

    // Keyboard and touch are summed, so opposite directions cancel out.
    let moveDir = 0;
    if (keyIsDown(LEFT_ARROW) || TouchControls.isHeld('left')) moveDir -= 1;
    if (keyIsDown(RIGHT_ARROW) || TouchControls.isHeld('right')) moveDir += 1;
    if (moveDir !== 0) player.move(moveDir);

    player.update();

    // plateform.y starts at canvasHeight and grows as the world scrolls down.
    Score.updateHeight(plateform.y - canvasHeight);

    Endless.recycle();

    if (shakeFrames > 0) shakeFrames--;
    if (damageFlash > 0) damageFlash--;
  }

  // Flash sits above the world but below the UI.
  if (damageFlash > 0) {
    noStroke();
    fill(200, 40, 40, 90 * (damageFlash / DAMAGE_FLASH_FRAMES));
    rect(0, 0, canvasWidth, canvasHeight);
  }

  drawStatusArea();
  TouchControls.draw();

  if (paused) {
    drawPauseOverlay();
    return;
  }

  for (let i = objects.length - 1; i >= 0; i--) {
    if (player.collidesWith(objects[i])) {
      if (objects[i] instanceof Danger) {
        // Monster extends Danger, and the two use different sounds.
        (objects[i] instanceof Monster ? ghostSound : fireSound).play();
        player.loseLife();
        objects.splice(i, 1);
      } else if (objects[i] instanceof Candy) {
        getCoinSound.play();
        candyCount++;
        Score.addCandy();
        objects.splice(i, 1);
        if (candyCount >= 3) {
          player.addLife();
          candyCount = 0;
        }
      } else if (objects[i] instanceof Halo && life > 0) {
        gameScreen = "youWin";
        objects.splice(i, 1);
      }
    }
  }
}

function drawPauseOverlay() {
  push();
  noStroke();
  fill(255, 190);
  rect(0, statusAreaHeight, canvasWidth, canvasHeight - statusAreaHeight);

  textAlign(CENTER, CENTER);
  fill(60);
  textSize(54);
  text("Paused", canvasWidth / 2, canvasHeight / 2 - 30);
  textSize(20);
  fill(110);
  text("ESC / P  resume        M  mute", canvasWidth / 2, canvasHeight / 2 + 30);
  pop();
}

function drawStatusArea() {
  // push/pop isolates text alignment and tint from the rest of the frame.
  push();

  fill(225);
  rect(0, 0, canvasWidth, statusAreaHeight);
  noStroke();

  for (let i = 0; i < hearts.length; i++) {
    if (i < life) {
      hearts[i].show(1);
    } else {
      hearts[i].show(0);
    }
  }
  noTint();

  let coinIconSize = 70;
  let coinIconX = canvasWidth - 120;
  let coinIconY = -7;
  image(candyImg, coinIconX, coinIconY, coinIconSize, coinIconSize);
  fill(0);
  textAlign(LEFT, TOP);
  textSize(25);
  text(candyCount, coinIconX + coinIconSize + 5, coinIconY + coinIconSize - 45);

  // Score sits between the hearts on the left and the candy count on the right.
  textAlign(CENTER, CENTER);
  fill(120);
  textSize(13);
  text("SCORE", canvasWidth / 2, statusAreaHeight / 2 - 12);
  fill(0);
  textSize(24);
  text(Score.current(), canvasWidth / 2, statusAreaHeight / 2 + 7);

  if (muted) {
    fill(150);
    textSize(13);
    textAlign(RIGHT, CENTER);
    text("MUTED", canvasWidth - 130, statusAreaHeight / 2);
  }

  pop();
}

function drawWinOrLoseScreen() {
  background(bgImg);
  if (gameScreen === "gameOver") {
    bgMusic.stop();
    if (loseMusic && !loseMusic.isPlaying()) {
      loseMusic.loop();
    }
  }

  winOrLoseFlashTimer++;
  let textSizeValue = 84 + map(sin(winOrLoseFlashTimer * 0.1), -1, 1, 0, 10);

  fill(178, 34, 34);
  textSize(textSizeValue);
  textAlign(CENTER, CENTER)
  let textContent = gameScreen === "gameOver" ? "Game Over!" : "You Win!";
  text(textContent, width / 2, 150);

  drawScorePanel();

  textSize(34);
  for (let btn of winOrLoseButtons) {
    // hover only drives colour; clicks are resolved by winOrLoseButtonAt().
    btn.hover = mouseX > btn.x - btn.w / 2 && mouseX < btn.x + btn.w / 2 &&
                mouseY > btn.y - btn.h / 2 && mouseY < btn.y + btn.h / 2;

    fill(btn.hover ? 'rgb(255,182,193)' : 'black');
    text(btn.label, btn.x, btn.y);
  }
}

/** Run score, stored best for the mode, and a new-record marker. */
function drawScorePanel() {
  push();
  textAlign(CENTER, CENTER);

  const panelY = 245;
  fill(40);
  textSize(30);
  text("Score  " + Score.current(), width / 2, panelY);

  fill(95);
  textSize(19);
  text("Best (" + scoreKey() + ")  " + Score.best(scoreKey()),
       width / 2, panelY + 30);

  if (isNewRecord) {
    const pulse = map(sin(winOrLoseFlashTimer * 0.15), -1, 1, 130, 255);
    fill(255, 140, 0, pulse);
    textSize(22);
    text("NEW RECORD!", width / 2, panelY + 58);
  }
  pop();
}

/** Volume is set per sound rather than through p5's global output. */
function allSounds() {
  return [bgMusic, loseMusic, jumpSound, getCoinSound, fireSound, ghostSound];
}

function applyMute() {
  for (const s of allSounds()) {
    if (s && typeof s.setVolume === 'function') {
      s.setVolume(muted ? 0 : 1);
    }
  }
}

function toggleMute() {
  muted = !muted;
  applyMute();
}

/** Called by Player.loseLife(). */
function triggerDamageFeedback() {
  damageFlash = DAMAGE_FLASH_FRAMES;
  shakeFrames = DAMAGE_SHAKE_FRAMES;
}

/** Browsers require a user gesture before audio starts, so every input calls this. */
function resumeAudio() {
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
  if (bgMusic && !bgMusic.isPlaying()) {
    bgMusic.loop();
  }
}

function isOverPlay(px = mouseX, py = mouseY) {
  return px > playX - playWidth / 2 && px < playX + playWidth / 2 &&
         py > playY - playHeight / 2 && py < playY + playHeight / 2;
}

/** The three bands match where drawDifficultyScreen() places the buttons. */
function difficultyAt(px, py) {
  const buttonWidth = 400;
  if (px < 190 || px > 190 + buttonWidth) {
    return null;
  }
  if (py > 200 && py < 270) return "easy";
  if (py > 350 && py < 420) return "medium";
  if (py > 500 && py < 570) return "hard";
  return null;
}

/** Resolved by position every time, never from the cached hover flag. */
function winOrLoseButtonAt(px, py) {
  for (const btn of winOrLoseButtons) {
    if (px > btn.x - btn.w / 2 && px < btn.x + btn.w / 2 &&
        py > btn.y - btn.h / 2 && py < btn.y + btn.h / 2) {
      return btn;
    }
  }
  return null;
}

/**
 * Shared press handling for mouse and touch, dispatched by screen. The "game"
 * screen deliberately handles no menu clicks at all.
 */
function handlePointerPress(px, py) {
  if (gameScreen === "start") {
    if (isOverPlay(px, py)) {
      gameScreen = "instruction";
    }
  } else if (gameScreen === "instruction") {
    if (isOverIgotit(px, py)) {
      gameScreen = "difficulty";
    }
  } else if (gameScreen === "difficulty") {
    // Checked first: the toggle sits outside the difficulty bands.
    if (isOverEndlessToggle(px, py)) {
      Endless.enabled = !Endless.enabled;
      return;
    }
    const picked = difficultyAt(px, py);
    if (picked) {
      selectedDifficulty = picked;
      startNewGame();
    }
  } else if (gameScreen === "gameOver" || gameScreen === "youWin") {
    const btn = winOrLoseButtonAt(px, py);
    if (!btn) {
      return;
    }
    if (btn.label === "Play Again") {
      restartGame();
    } else if (btn.label === "Settings") {
      resetGameData();
      gameScreen = "difficulty";
    } else if (btn.label === "Exit Game") {
      resetGameData();
      gameScreen = "start";
    }
  }
}

window.mousePressed = function() {
  resumeAudio();
  handlePointerPress(mouseX, mouseY);
};

/** Returning false makes p5 preventDefault, blocking scroll and double-tap zoom. */
function touchStarted() {
  resumeAudio();

  if (gameScreen === "game") {
    for (const t of touches) {
      if (TouchControls.at(t.x, t.y) === 'jump') {
        tryJump();
      }
    }
  } else if (touches.length > 0) {
    handlePointerPress(touches[0].x, touches[0].y);
  }
  return false;
}

function touchEnded() {
  if (gameScreen === "game" && !TouchControls.isHeld('jump')) {
    releaseJump();
  }
  return false;
}

function keyPressed() {
  resumeAudio();

  // Handled before the screen dispatch so mute works everywhere.
  if (keyCode === 77) {
    toggleMute();
    return;
  }

  if (gameScreen === "start") {
    if (keyCode === ENTER) gameScreen = "instruction";
  } else if (gameScreen === "instruction") {
    if (keyCode === ENTER) gameScreen = "difficulty";
  } else if (gameScreen === "gameOver" || gameScreen === "youWin") {
    if (keyCode === ENTER) {
      resetGameData();
      gameScreen = "start";
    }
  } else if (gameScreen === "game") {
    if (keyCode === 32) {                            // Space
      tryJump();
    } else if (keyCode === 27 || keyCode === 80) {   // Esc / P
      paused = !paused;
    }
  }
}

/** Registers intent only; Player.updateJumpAssist() decides when to jump. */
function tryJump() {
  if (player) {
    player.requestJump();
  }
}

function releaseJump() {
  if (player) {
    player.releaseJump();
  }
}

function keyReleased() {
  if (keyCode === 32) {
    releaseJump();
  }
}

/** Same as startNewGame(), but keeps the selected difficulty. */
function restartGame() {
  resetGameData();
  player = new Player(canvasWidth / 2, canvasHeight - grassHeight);
  generateGameElements();
  generateHeart();
  gameScreen = "game";
}

function startNewGame() {
  resetGameData();
  player = new Player(canvasWidth / 2, canvasHeight - grassHeight);
  generateGameElements();
  generateHeart();
  gameScreen = "game";
}

function resetGameData() {
  life = 3;
  candyCount = 0;

  clouds = [];
  objects = [];
  hearts = [];
  player = null;

  Score.reset();
  Endless.reset();
  scoreSaved = false;
  isNewRecord = false;
  cameraPending = 0;
  paused = false;
  damageFlash = 0;
  shakeFrames = 0;

  if (loseMusic.isPlaying()) {
    loseMusic.stop();
  }
}

/** Builds the level. The player and hearts are created by the caller. */
function generateGameElements() {
  plateform = new Plateform(canvasWidth / 2, canvasHeight);
  clouds = generateClouds(random(60, 200), random(canvasHeight - 60 - grassHeight, canvasHeight - 90));
  firstLevelY = clouds[0].y;

  // The halo's cloud has to be stable; climbing all the way up only to land on
  // a vanishing cloud would be the worst possible way to lose a run.
  const topIndex = clouds.length - 1;
  if (clouds[topIndex].constructor !== Cloud) {
    clouds[topIndex] = new Cloud(clouds[topIndex].x, clouds[topIndex].y);
  }

  objects = [];

  for (let i = 0; i < clouds.length; i++) {
    let cloud = clouds[i];
    if (i === clouds.length - 1 && !Endless.enabled) {
      objects.push(new Halo(cloud));
    } else if (!canHoldItem(cloud)) {
      objects.push(new Objects(cloud));
    } else {
      if (selectedDifficulty === "easy") {
        if (random() < 0.3) {
          objects.push(new Candy(cloud));
        } else {
          objects.push(new Objects(cloud));
        }
      } else if (selectedDifficulty === "medium") {
        if (random() < 0.3) {
          objects.push(new Candy(cloud));
        } else if (random() < 0.2) {
          objects.push(new Danger(cloud));
        } else {
          objects.push(new Objects(cloud));
        }
      } else if (selectedDifficulty === "hard") {
        if (random() < 0.3) {
          objects.push(new Candy(cloud));
        } else if (random() < 0.2) {
          objects.push(new Monster(cloud));
        } else if (random() < 0.2) {
          objects.push(new Danger(cloud));
        } else {
          objects.push(new Objects(cloud));
        }
      }
    }
  }
}

/** Picks a static cloud class according to the current difficulty's mix. */
function pickStaticCloudType() {
  const mix = CLOUD_MIX[selectedDifficulty] || CLOUD_MIX.easy;
  const roll = random();
  let acc = mix.spring;
  if (roll < acc) return SpringCloud;
  acc += mix.vanishing;
  if (roll < acc) return VanishingCloud;
  acc += mix.falling;
  if (roll < acc) return FallingCloud;
  return Cloud;
}

/** Unstable clouds carry no items, or the item would be left hanging in mid-air. */
function canHoldItem(cloud) {
  return !(cloud instanceof VanishingCloud) && !(cloud instanceof FallingCloud);
}

/** Three clouds per level, alternating direction as the level rises. */
function generateClouds(x, y) {
  let prevXMin = x - cloudWidth / 2, prevXMax = x + cloudWidth / 2, prevX = x;
  let prevY = y;
  let movingCloudsRatio = difficultyConfig().movingRatio;
  clouds.push(new Cloud(x, y));

  for (let i = 1; i < numClouds; i++) {
    let newY, newX;
    if (i % 3 !== 0) {
      newY = prevY;
    } else {
      const cfg = difficultyConfig();
      newY = prevY - random(cfg.gapMin, cfg.gapMax);
    }

    if (random() < movingCloudsRatio) {
      newX = nextCloudX(prevX, prevXMin, prevXMax, i, movingDistance);
      if (newX === prevX && i % 3 !== 0) {   // would overlap; skip this cloud
        continue;
      } else {
        clouds.push(new MovingCloud(newX, newY));
        prevXMin = newX - cloudWidth / 2 - movingDistance;
        prevXMax = newX + cloudWidth / 2 + movingDistance;
      }
    } else {
      newX = nextCloudX(prevX, prevXMin, prevXMax, i, 0);
      if (newX === prevX && i % 3 !== 0) {
        continue;
      } else {
        const CloudType = pickStaticCloudType();
        clouds.push(new CloudType(newX, newY));
        prevXMin = newX - cloudWidth / 2;
        prevXMax = newX + cloudWidth / 2;
      }
    }

    prevX = newX;
    prevY = newY;
  }
  return clouds;
}

/**
 * Horizontal placement for the next cloud. Levels fill left to right and then
 * right to left, so a route always exists. moveSlack reserves extra room for
 * clouds that will drift.
 */
function nextCloudX(prevX, prevXMin, prevXMax, i, moveSlack) {
  let newX;
  let level = Math.floor(i / 3);
  if (i % 3 === 0) {                  // first cloud of a new level; may overlap
    newX = prevX + random(-cloudWidth * 2, cloudWidth * 2);
    newX = newX < cloudWidth ? cloudWidth : newX;
    newX = newX > canvasWidth - cloudWidth ? canvasWidth - cloudWidth : newX;
  } else if (level % 2 !== 0) {       // same level, extending left
    newX = prevXMin + random(-cloudWidth * 2, -cloudWidth) - moveSlack;
    newX = newX < cloudWidth ? cloudWidth : newX;
    newX = (newX + cloudWidth / 2 + moveSlack>= prevXMin) ? prevX : newX;
  } else {                            // same level, extending right
    newX = prevXMax + random(cloudWidth, cloudWidth * 2) + moveSlack;
    newX = newX > canvasWidth - cloudWidth ? canvasWidth - cloudWidth : newX;
    newX = (newX - cloudWidth / 2 - moveSlack <= prevXMax) ? prevX : newX;
  }
  return newX;
}

function generateHeart() {
  let gapWidth = 20;
  let size = 40;
  for (let i = 0; i < numCoinOrHeart; i++) {
    let heart = new LifeHeart((i + 1) * gapWidth + size / 2 * (2 * i + 1), statusAreaHeight / 2, size);
    hearts.push(heart);
  }
}
