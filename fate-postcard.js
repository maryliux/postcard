const creatorPostcard = document.querySelector("#creatorPostcard");
const creatorPostcardInner = document.querySelector("#creatorPostcardInner");
const creatorFrontImage3d = document.querySelector("#creatorFrontImage3d");
const creatorFrontImage2d = document.querySelector("#creatorFrontImage2d");
const creatorView3d = document.querySelector("#creatorView3d");
const creatorView2d = document.querySelector("#creatorView2d");
const mode3dButton = document.querySelector("#mode3dButton");
const mode2dButton = document.querySelector("#mode2dButton");
const fortuneLines = [
  document.querySelector("#fortuneLine1"),
  document.querySelector("#fortuneLine2"),
  document.querySelector("#fortuneLine3"),
];

const UPLOAD_STORAGE_KEY = "uploadedPostcardFrontImage";
const BASE_PITCH = 8;
const BASE_ROLL = -5;
const FRONT_YAW = -12;
const BACK_YAW = FRONT_YAW + 180;
const DRAG_YAW_SENSITIVITY = 0.42;
const DRAG_PITCH_SENSITIVITY = 0.28;
const DRAG_ROLL_SENSITIVITY = 0.08;
const MAX_PITCH_OFFSET = 34;
const MAX_ROLL_OFFSET = 16;
const DRAG_LERP = 0.34;
const SETTLE_LERP = 0.18;
const INERTIA_MULTIPLIER = 120;
const STOP_EPSILON = 0.03;
const FORTUNES = [
  "fate says your next yes changes everything.",
  "a sweet surprise finds you this week.",
  "someone kind is about to choose you.",
  "you are one brave choice from a glow-up.",
  "your luck wakes up after sunset.",
  "a delayed dream returns better than planned.",
  "the right message arrives at the right hour.",
  "you are stepping into your loudest confidence.",
  "the next chapter starts with one risk.",
  "your future self is already proud of this move.",
  "the universe rewards your bold timing.",
  "your most magnetic era starts now.",
];

let isDragging = false;
let moved = false;
let startX = 0;
let startY = 0;
let startRotateX = 0;
let startRotateY = 0;
let startRotateZ = 0;
let currentRotateX = 0;
let currentRotateY = 0;
let currentRotateZ = 0;
let targetRotateX = 0;
let targetRotateY = 0;
let targetRotateZ = 0;
let showingBack = false;
let activePointerId = null;
let lastPointerX = 0;
let lastPointerTime = 0;
let pointerVelocityX = 0;
let animationFrameId = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(value) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function pickRandomUnique(items, count) {
  const pool = [...items];
  const chosen = [];

  while (pool.length > 0 && chosen.length < count) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(randomIndex, 1)[0]);
  }

  return chosen;
}

function setRandomFortunes() {
  const selected = pickRandomUnique(FORTUNES, fortuneLines.length);
  fortuneLines.forEach((line, index) => {
    if (!line) {
      return;
    }
    line.textContent = selected[index] || FORTUNES[index % FORTUNES.length];
  });
}

function getUploadedFrontImage() {
  try {
    return window.sessionStorage.getItem(UPLOAD_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

function applyFrontImage() {
  const uploadedImage = getUploadedFrontImage();
  const src = uploadedImage || "frontcard.png";

  if (creatorFrontImage3d) {
    creatorFrontImage3d.src = src;
  }
  if (creatorFrontImage2d) {
    creatorFrontImage2d.src = src;
  }
}

function renderTransform() {
  if (!creatorPostcardInner) {
    return;
  }

  creatorPostcardInner.style.transform = `
    rotateX(${currentRotateX}deg)
    rotateY(${currentRotateY}deg)
    rotateZ(${currentRotateZ}deg)
  `;
}

function animateFrame() {
  const lerp = isDragging ? DRAG_LERP : SETTLE_LERP;
  currentRotateX += (targetRotateX - currentRotateX) * lerp;
  currentRotateY += (targetRotateY - currentRotateY) * lerp;
  currentRotateZ += (targetRotateZ - currentRotateZ) * lerp;
  renderTransform();

  const xRemaining = Math.abs(targetRotateX - currentRotateX);
  const yRemaining = Math.abs(targetRotateY - currentRotateY);
  const zRemaining = Math.abs(targetRotateZ - currentRotateZ);
  const keepAnimating = isDragging || xRemaining > STOP_EPSILON || yRemaining > STOP_EPSILON || zRemaining > STOP_EPSILON;

  if (keepAnimating) {
    animationFrameId = requestAnimationFrame(animateFrame);
    return;
  }

  currentRotateX = targetRotateX;
  currentRotateY = targetRotateY;
  currentRotateZ = targetRotateZ;
  renderTransform();
  animationFrameId = null;
}

function ensureAnimationLoop() {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(animateFrame);
  }
}

function commitFaceState(showBack) {
  showingBack = showBack;
  targetRotateY = showingBack ? BACK_YAW : FRONT_YAW;
  targetRotateX = BASE_PITCH;
  targetRotateZ = BASE_ROLL;
  ensureAnimationLoop();
}

function onPointerDown(event) {
  if (!creatorPostcard || creatorView3d?.hidden) {
    return;
  }

  activePointerId = event.pointerId;
  isDragging = true;
  moved = false;
  startX = event.clientX;
  startY = event.clientY;
  targetRotateX = currentRotateX;
  targetRotateY = currentRotateY;
  targetRotateZ = currentRotateZ;
  startRotateX = currentRotateX;
  startRotateY = currentRotateY;
  startRotateZ = currentRotateZ;
  lastPointerX = event.clientX;
  lastPointerTime = performance.now();
  pointerVelocityX = 0;
  creatorPostcard.classList.add("is-dragging");
  creatorPostcard.setPointerCapture(activePointerId);
  if (creatorPostcardInner) {
    creatorPostcardInner.style.transition = "none";
  }
  ensureAnimationLoop();
}

function onPointerMove(event) {
  if (!isDragging || event.pointerId !== activePointerId) {
    return;
  }

  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;
  const now = performance.now();
  const elapsed = Math.max(1, now - lastPointerTime);
  const instantVelocityX = (event.clientX - lastPointerX) / elapsed;
  pointerVelocityX = pointerVelocityX * 0.72 + instantVelocityX * 0.28;
  lastPointerX = event.clientX;
  lastPointerTime = now;

  if (Math.hypot(deltaX, deltaY) > 4) {
    moved = true;
  }

  targetRotateY = startRotateY + deltaX * DRAG_YAW_SENSITIVITY;
  targetRotateX = clamp(
    startRotateX - deltaY * DRAG_PITCH_SENSITIVITY,
    BASE_PITCH - MAX_PITCH_OFFSET,
    BASE_PITCH + MAX_PITCH_OFFSET
  );
  targetRotateZ = clamp(
    startRotateZ + deltaX * DRAG_ROLL_SENSITIVITY,
    BASE_ROLL - MAX_ROLL_OFFSET,
    BASE_ROLL + MAX_ROLL_OFFSET
  );
  ensureAnimationLoop();
}

function releasePointerIfCaptured() {
  if (creatorPostcard && activePointerId !== null && creatorPostcard.hasPointerCapture(activePointerId)) {
    creatorPostcard.releasePointerCapture(activePointerId);
  }
}

function onPointerUp(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  if (creatorPostcard) {
    creatorPostcard.classList.remove("is-dragging");
  }
  releasePointerIfCaptured();
  isDragging = false;
  activePointerId = null;
  if (creatorPostcardInner) {
    creatorPostcardInner.style.transition = "";
  }

  if (!moved) {
    commitFaceState(!showingBack);
    return;
  }

  const projectedYaw = targetRotateY + pointerVelocityX * INERTIA_MULTIPLIER;
  const normalized = normalizeAngle(projectedYaw);
  const shouldShowBack = normalized > 90 && normalized < 270;
  commitFaceState(shouldShowBack);
}

function onPointerCancel(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  if (creatorPostcard) {
    creatorPostcard.classList.remove("is-dragging");
  }
  releasePointerIfCaptured();
  isDragging = false;
  activePointerId = null;
  if (creatorPostcardInner) {
    creatorPostcardInner.style.transition = "";
  }
  commitFaceState(showingBack);
}

function onCardKeyDown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  commitFaceState(!showingBack);
}

function setMode(mode) {
  const is3d = mode === "3d";

  if (creatorView3d) {
    creatorView3d.hidden = !is3d;
  }
  if (creatorView2d) {
    creatorView2d.hidden = is3d;
  }
  if (mode3dButton) {
    mode3dButton.classList.toggle("is-active", is3d);
  }
  if (mode2dButton) {
    mode2dButton.classList.toggle("is-active", !is3d);
  }

  if (is3d) {
    commitFaceState(showingBack);
  }
}

if (creatorPostcard) {
  creatorPostcard.addEventListener("pointerdown", onPointerDown);
  creatorPostcard.addEventListener("pointermove", onPointerMove);
  creatorPostcard.addEventListener("pointerup", onPointerUp);
  creatorPostcard.addEventListener("pointercancel", onPointerCancel);
  creatorPostcard.addEventListener("keydown", onCardKeyDown);
}

if (mode3dButton && mode2dButton) {
  mode3dButton.addEventListener("click", () => setMode("3d"));
  mode2dButton.addEventListener("click", () => setMode("2d"));
}

if (creatorPostcardInner) {
  creatorPostcardInner.style.transition = "none";
}

applyFrontImage();
setRandomFortunes();
commitFaceState(false);
if (creatorPostcardInner) {
  creatorPostcardInner.style.transition = "";
}
