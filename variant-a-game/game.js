// =====================================================================
//  GUT RUN – a tiny Flappy-style game ad
//  Everything is measured in "design pixels" (the stage is 360 x 640).
// =====================================================================

// ---------- Settings (change these to tune the game) ----------
const clickTag = window.clickTag || "https://example.com/landing";

const STAGE_W = 360;
const STAGE_H = 640;

const PLAYER_X = 55; // the player never moves left/right
const PLAYER_START_Y = 258;
const PLAYER_W = 42;
const PLAYER_H = 41;

const PLAY_TOP = 168; // above this = out of the playfield (navy headline area)
const PLAY_BOTTOM = 640; // below this = out of the playfield

const GRAVITY = 1400; // px per second², pulls the player down
const JUMP_SPEED = -400; // px per second, negative = up

const START_SPEED = 90; // how fast the gut scrolls (px per second)
const MAX_SPEED = 140;
const SPEED_RAMP = 3; // speed gained every second (gentle difficulty ramp)

const GUT_WIDTH = 2528; // gameplay.png is 5056px wide @2x
const TRACK_END = GUT_WIDTH - STAGE_W; // how far the track can scroll

const FIRST_OBSTACLE_X = 380; // a short "get ready" gap before the first obstacle
const OBSTACLE_GAP = 118; // distance between obstacles

// Obstacle sizes in design pixels (image size / 2).
// "shrink" = how much of each side is ignored for collision (transparent edges).
const OBSTACLES = [
  { name: "bac1", w: 62.5, h: 59.5, shrink: 0.18 },
  { name: "bac2", w: 21.5, h: 77, shrink: 0.12 },
  { name: "bac3", w: 79, h: 28, shrink: 0.12 },
  { name: "bac4", w: 69, h: 34, shrink: 0.15 },
  { name: "bac5", w: 53.5, h: 43.5, shrink: 0.15 },
  { name: "bac6", w: 50, h: 47.5, shrink: 0.18 },
  { name: "txt1", w: 23, h: 94, shrink: 0.08 },
  { name: "txt2", w: 34, h: 113, shrink: 0.08 },
  { name: "txt3", w: 23.5, h: 60.5, shrink: 0.08 },
  { name: "txt4", w: 29, h: 84.5, shrink: 0.08 },
  { name: "txt5", w: 30, h: 181, shrink: 0.08 },
  { name: "txt6", w: 20.5, h: 144.5, shrink: 0.08 },
  { name: "txt7", w: 29.5, h: 81.5, shrink: 0.08 },
  { name: "txt8", w: 18.5, h: 153, shrink: 0.08 },
  { name: "txt9", w: 25.5, h: 156.5, shrink: 0.08 },
];
const PLAYER_SHRINK = 0.2;

const DEBUG = new URLSearchParams(location.search).has("debug");
const REDUCED_MOTION = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

// ---------- HTML elements ----------
const stage = document.getElementById("stage");
const track = document.getElementById("track");
const player = document.getElementById("player");
const startScreen = document.getElementById("start");
const failScreen = document.getElementById("fail");
const winScreen = document.getElementById("win");
const muteButton = document.getElementById("mute");
const debugLayer = document.getElementById("debug-layer");

// ---------- Sounds ----------
const sounds = {
  music: new Audio("assets/music/background_music/Funny Game Loop.mp3"),
  crash: new Audio("assets/music/crash/Cartoon Crash Boing.mp3"),
  fail: new Audio("assets/music/endcard_fail/Fail.mp3"),
  applause: new Audio("assets/music/endcard_win/applause.mp3"),
  cheer: new Audio(
    "assets/music/endcard_win/Celebrative Happy Woohoo Cheer 2.mp3",
  ),
};
sounds.music.loop = true;
sounds.music.volume = 0.5;

// ---------- Game state ----------
let state = "start"; // 'start' | 'playing' | 'over'
let playerY = PLAYER_START_Y;
let velocity = 0;
let trackX = 0; // 0 = start, -TRACK_END = finish
let speed = START_SPEED;
let obstacles = []; // { x, y, w, h, shrink }
let frameId = null; // requestAnimationFrame id
let lastTime = null; // time of the previous frame
let endTimer = null; // delay between crash/finish and the endcard
let endcardTimeline = null;
let soundsUnlocked = false;
let soundsPausedByTab = [];

// =====================================================================
//  Scaling: fit the 360x640 stage into any phone screen, no distortion
// =====================================================================
function fitStage() {
  const scale = Math.min(
    window.innerWidth / STAGE_W,
    window.innerHeight / STAGE_H,
  );
  // center it, rounded to whole pixels so the edges stay sharp
  const left = Math.round((window.innerWidth - STAGE_W * scale) / 2);
  const top = Math.round((window.innerHeight - STAGE_H * scale) / 2);
  stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
}

// =====================================================================
//  Sound helpers
// =====================================================================
function playSound(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {}); // ignore "autoplay blocked" errors
}

function stopAllSounds() {
  for (const sound of Object.values(sounds)) {
    sound.pause();
    sound.currentTime = 0;
  }
}

let isMuted = false;
function toggleMute() {
  isMuted = !isMuted;
  for (const sound of Object.values(sounds)) {
    sound.muted = isMuted;
  }
  muteButton.textContent = isMuted ? "🔇" : "🔊";
  muteButton.setAttribute("aria-label", isMuted ? "Ton an" : "Ton aus");
}

// =====================================================================
//  Obstacles
// =====================================================================
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Every obstacle appears exactly once per run, in a random order.
function createObstacles() {
  track.querySelectorAll(".obstacle").forEach((el) => el.remove());
  obstacles = [];

  shuffle(OBSTACLES).forEach((data, index) => {
    const x = FIRST_OBSTACLE_X + index * OBSTACLE_GAP;
    const y = randomBetween(200, 585 - data.h);

    const img = document.createElement("img");
    img.className = "obstacle";
    img.src = `assets/01_game/${data.name}.png`;
    img.alt = "";
    img.style.left = x + "px";
    img.style.top = y + "px";
    img.style.width = data.w + "px";
    img.style.height = data.h + "px";
    track.appendChild(img);

    obstacles.push({ x, y, w: data.w, h: data.h, shrink: data.shrink });
  });
}

// =====================================================================
//  Collision (simple rectangles, made smaller so it feels fair)
// =====================================================================
function makeBox(x, y, w, h, shrink) {
  const padX = w * shrink;
  const padY = h * shrink;
  return {
    left: x + padX,
    top: y + padY,
    right: x + w - padX,
    bottom: y + h - padY,
  };
}

function boxesOverlap(a, b) {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

function getPlayerBox() {
  return makeBox(PLAYER_X, playerY, PLAYER_W, PLAYER_H, PLAYER_SHRINK);
}

function getObstacleBoxes() {
  // obstacle.x is its position on the track, so add trackX to get its screen position
  return obstacles.map((o) => makeBox(o.x + trackX, o.y, o.w, o.h, o.shrink));
}

function drawHitboxes(boxes) {
  debugLayer.innerHTML = "";
  for (const box of boxes) {
    const div = document.createElement("div");
    div.className = "hitbox";
    div.style.left = box.left + "px";
    div.style.top = box.top + "px";
    div.style.width = box.right - box.left + "px";
    div.style.height = box.bottom - box.top + "px";
    debugLayer.appendChild(div);
  }
}

// =====================================================================
//  Game loop
// =====================================================================
function gameLoop(time) {
  if (lastTime === null) lastTime = time;
  // seconds since last frame (capped, so a slow frame doesn't teleport the player)
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  update(dt);
  render();

  if (state === "playing") {
    frameId = requestAnimationFrame(gameLoop);
  }
}

function update(dt) {
  // move the gut and obstacles to the left
  speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * dt);
  trackX -= speed * dt;

  // gravity pulls the player down
  velocity += GRAVITY * dt;
  playerY += velocity * dt;

  // did we crash?
  const playerBox = getPlayerBox();
  const outOfField = playerBox.top < PLAY_TOP || playerBox.bottom > PLAY_BOTTOM;
  const hitObstacle = getObstacleBoxes().some((box) =>
    boxesOverlap(playerBox, box),
  );

  if (outOfField || hitObstacle) {
    loseGame();
  } else if (trackX <= -TRACK_END) {
    trackX = -TRACK_END;
    winGame();
  }
}

function render() {
  gsap.set(track, { x: trackX });
  // tilt the player a little: up when jumping, down when falling
  const tilt = Math.max(-20, Math.min(30, velocity * 0.05));
  gsap.set(player, { y: playerY - PLAYER_START_Y, rotation: tilt });

  if (DEBUG) {
    drawHitboxes([getPlayerBox(), ...getObstacleBoxes()]);
  }
}

function jump() {
  velocity = JUMP_SPEED;
}

// =====================================================================
//  Start / end of a run
// =====================================================================
function startGame() {
  state = "playing";
  playSound(sounds.music);

  // stop the start screen animations and fade the tutorial away
  gsap.killTweensOf([player, "#gesture", "#tut", ".decor"]);
  gsap.set(player, { x: 0 }); // in case the tap came before the intro finished
  gsap.to(startScreen, {
    opacity: 0,
    duration: 0.4,
    ease: "power1.out",
    onComplete: () => startScreen.classList.add("hidden"),
  });

  jump(); // the first tap is also the first jump
  lastTime = null;
  frameId = requestAnimationFrame(gameLoop);
}

function loseGame() {
  state = "over";
  sounds.music.pause();
  playSound(sounds.crash);

  // little shake, then the fail endcard
  gsap.to(player, {
    x: 4,
    duration: 0.05,
    repeat: 5,
    yoyo: true,
    ease: "none",
  });
  endTimer = gsap.delayedCall(0.8, showFailScreen);
}

function winGame() {
  state = "over";
  sounds.music.pause();

  // the poo runs out of the screen, then the win endcard
  gsap.to(player, { x: 340, rotation: 0, duration: 0.7, ease: "power2.in" });
  endTimer = gsap.delayedCall(0.8, showWinScreen);
}

// Replay: clean everything, then start a new run right away.
function resetGame() {
  cancelAnimationFrame(frameId);
  if (endTimer) endTimer.kill();
  if (endcardTimeline) endcardTimeline.kill();
  gsap.killTweensOf(player);
  gsap.set([player, failScreen, winScreen, ".screen img"], {
    clearProps: "transform,opacity",
  });
  stopAllSounds();

  failScreen.classList.add("hidden");
  winScreen.classList.add("hidden");

  playerY = PLAYER_START_Y;
  velocity = 0;
  trackX = 0;
  speed = START_SPEED;
  createObstacles();
  render();

  startGame();
}

// =====================================================================
//  Endcards (entrance animations with GSAP)
// =====================================================================
function showFailScreen() {
  debugLayer.innerHTML = "";
  failScreen.classList.remove("hidden");
  playSound(sounds.fail);

  endcardTimeline = gsap
    .timeline()
    .from(failScreen, { opacity: 0, duration: 0.3 })
    .from(".fail-bubble", {
      scale: 0,
      transformOrigin: "50% 35%",
      duration: 0.5,
      ease: "back.out(1.7)",
    })
    .from(
      ".fail-sad",
      { y: -120, opacity: 0, duration: 0.8, ease: "bounce.out" },
      "-=0.2",
    )
    .from(
      ".fail-bac",
      {
        scale: 0,
        opacity: 0,
        transformOrigin: "50% 30%",
        duration: 0.4,
        stagger: 0.08,
        ease: "back.out(2)",
      },
      "-=0.5",
    )
    .from([".fail-hl", "#fail-cta", "#replay"], {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.12,
      ease: "power2.out",
    });

  if (!REDUCED_MOTION) {
    endcardTimeline.to("#fail-cta", {
      scale: 1.05,
      duration: 0.6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }
}

function showWinScreen() {
  debugLayer.innerHTML = "";
  winScreen.classList.remove("hidden");
  playSound(sounds.applause);
  playSound(sounds.cheer);

  endcardTimeline = gsap
    .timeline()
    .from(winScreen, { opacity: 0, duration: 0.3 })
    .from(".win-bubble", {
      scale: 0,
      transformOrigin: "50% 35%",
      duration: 0.5,
      ease: "back.out(1.7)",
    })
    .from(
      ".win-confetti",
      {
        // the confetti bursts out of the party hat (top left)
        scale: REDUCED_MOTION ? 1 : 0.2,
        opacity: 0,
        transformOrigin: "15% 20%",
        duration: 0.8,
        ease: "expo.out",
      },
      "-=0.2",
    )
    .from(
      ".win-happy",
      { y: -120, opacity: 0, duration: 0.8, ease: "bounce.out" },
      "-=0.5",
    )
    .from([".win-hl", "#win-cta"], {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.12,
      ease: "power2.out",
    });

  if (!REDUCED_MOTION) {
    endcardTimeline.to("#win-cta", {
      scale: 1.05,
      duration: 0.6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }
}

// =====================================================================
//  Start screen intro animation
// =====================================================================
function playIntro() {
  gsap.from("#tut", { y: -30, opacity: 0, duration: 0.8, ease: "power3.out" });
  gsap.from(player, {
    x: -100,
    duration: 0.9,
    ease: "back.out(1.4)",
    delay: 0.2,
  });
  gsap.from(".decor", {
    scale: 0,
    opacity: 0,
    duration: 0.5,
    stagger: 0.1,
    delay: 0.4,
    ease: "back.out(2)",
  });
  gsap.from("#gesture", { opacity: 0, duration: 0.5, delay: 0.8 });

  if (!REDUCED_MOTION) {
    // gentle floating poo and a "tapping" hand
    gsap.to(player, {
      y: -8,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 1.1,
    });
    gsap.to("#gesture", {
      scale: 0.88,
      transformOrigin: "30% 15%",
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 1.3,
    });
  }
}

// =====================================================================
//  Pause when the tab / ad is not visible
// =====================================================================
function handleVisibilityChange() {
  if (document.hidden) {
    cancelAnimationFrame(frameId);
    gsap.globalTimeline.pause();
    soundsPausedByTab = Object.values(sounds).filter((sound) => !sound.paused);
    soundsPausedByTab.forEach((sound) => sound.pause());
  } else {
    gsap.globalTimeline.resume();
    soundsPausedByTab.forEach((sound) => sound.play().catch(() => {}));
    soundsPausedByTab = [];
    if (state === "playing") {
      lastTime = null; // so the time spent hidden is not counted
      frameId = requestAnimationFrame(gameLoop);
    }
  }
}

// =====================================================================
//  Events
// =====================================================================
stage.addEventListener("pointerdown", (event) => {
  // buttons have their own click handlers
  if (event.target.closest(".button, #mute")) return;

  if (state === "start") startGame();
  else if (state === "playing") jump();
});

document
  .getElementById("fail-cta")
  .addEventListener("click", () => window.open(clickTag, "_blank"));
document
  .getElementById("win-cta")
  .addEventListener("click", () => window.open(clickTag, "_blank"));
document.getElementById("replay").addEventListener("click", resetGame);
muteButton.addEventListener("click", toggleMute);
document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("resize", fitStage);

// ---------- Go! ----------
fitStage();
createObstacles();
playIntro();
