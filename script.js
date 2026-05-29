const postcard = document.querySelector("#postcard");
const postcardInner = document.querySelector("#postcardInner");
const doodles = Array.from(document.querySelectorAll(".postcard__doodles .doodle"));

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
const LYRIC_STYLE_ANNOTATIONS = [
  "from the moment i saw you, i started rewriting my future in glitter pen.",
  "i keep dancing like the world is ending and somehow it keeps saving me.",
  "if loving you is a bad idea, then let this song be my alibi tonight.",
  "i wore my heart like eyeliner and hoped the night would understand me.",
  "somewhere between midnight and sunrise, i decided i belong to the stars.",
  "every room gets louder when i laugh, softer when i leave, and i love that.",
  "they called it chaos but i called it choreography for my comeback season.",
  "i fall in love with moments first, people second, and memories forever.",
  "my dreams are too bright for closed curtains and too wild for quiet endings.",
  "i write your name in the margins like a chorus i cannot stop humming.",
  "we were never subtle, we were fireworks pretending to be candlelight.",
  "if fate is listening, tell her i want the dramatic version of everything.",
  "i keep a pocket full of wishes and spend them all before the morning comes.",
  "some hearts break, mine remixes the pain and turns it into a dance track.",
  "i was made for beautiful trouble and a future that sparkles a little too loud.",
  "if this is a love song, let it be the one people scream in the car at 2am.",
  "i choose wonder every time, even when the ending is uncertain and electric.",
  "tell destiny i am late because i stopped to romanticize the entire night sky.",
  "i learned to survive softly, loudly, and with perfect timing in high heels.",
  "we were always a little legendary, just waiting for the right lighting.",
];
const DOODLE_ZONES = [
  {
    horizontalProp: "right",
    horizontalRange: [-44, -30],
    verticalProp: "top",
    verticalRange: [6, 24],
    rotationRange: [-12, -2],
    widthRange: [8.1, 11.2],
  },
  {
    horizontalProp: "left",
    horizontalRange: [-53, -37],
    verticalProp: "bottom",
    verticalRange: [4, 18],
    rotationRange: [5, 14],
    widthRange: [8.7, 12.2],
  },
  {
    horizontalProp: "right",
    horizontalRange: [-43, -28],
    verticalProp: "top",
    verticalRange: [-18, -4],
    rotationRange: [-9, 4],
    widthRange: [7.9, 10.8],
  },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
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

function applyRandomizedAnnotations() {
  if (doodles.length === 0) {
    return;
  }

  const annotationTexts = pickRandomUnique(LYRIC_STYLE_ANNOTATIONS, doodles.length);

  doodles.forEach((doodle, index) => {
    const textElement = doodle.querySelector(".doodle__text");
    const zone = DOODLE_ZONES[index % DOODLE_ZONES.length];
    const annotationText = annotationTexts[index] || LYRIC_STYLE_ANNOTATIONS[index % LYRIC_STYLE_ANNOTATIONS.length];

    if (textElement) {
      textElement.textContent = annotationText;
    }

    doodle.style.left = "";
    doodle.style.right = "";
    doodle.style.top = "";
    doodle.style.bottom = "";

    const horizontalValue = randomInRange(zone.horizontalRange[0], zone.horizontalRange[1]).toFixed(1);
    const verticalValue = randomInRange(zone.verticalRange[0], zone.verticalRange[1]).toFixed(1);
    const rotationValue = randomInRange(zone.rotationRange[0], zone.rotationRange[1]).toFixed(1);
    const widthValue = randomInRange(zone.widthRange[0], zone.widthRange[1]).toFixed(2);

    doodle.style[zone.horizontalProp] = `${horizontalValue}%`;
    doodle.style[zone.verticalProp] = `${verticalValue}%`;
    doodle.style.transform = `rotate(${rotationValue}deg)`;
    doodle.style.maxWidth = `${widthValue}rem`;
  });
}

function normalizeAngle(value) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function renderTransform() {
  postcardInner.style.transform = `
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
  postcard.classList.add("is-dragging");
  postcard.setPointerCapture(activePointerId);
  postcardInner.style.transition = "none";
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
  if (activePointerId !== null && postcard.hasPointerCapture(activePointerId)) {
    postcard.releasePointerCapture(activePointerId);
  }
}

function onPointerUp(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  postcard.classList.remove("is-dragging");
  releasePointerIfCaptured();
  isDragging = false;
  activePointerId = null;
  postcardInner.style.transition = "";

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

  postcard.classList.remove("is-dragging");
  releasePointerIfCaptured();
  isDragging = false;
  activePointerId = null;
  postcardInner.style.transition = "";
  commitFaceState(showingBack);
}

function onKeyDown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  commitFaceState(!showingBack);
}

postcard.addEventListener("pointerdown", onPointerDown);
postcard.addEventListener("pointermove", onPointerMove);
postcard.addEventListener("pointerup", onPointerUp);
postcard.addEventListener("pointercancel", onPointerCancel);
postcard.addEventListener("keydown", onKeyDown);

postcardInner.style.transition = "none";
applyRandomizedAnnotations();
commitFaceState(false);
