const postcard = document.querySelector("#postcard");
const postcardInner = document.querySelector("#postcardInner");
const doodles = Array.from(document.querySelectorAll(".postcard__doodles .doodle"));
const doodleLayer = document.querySelector(".postcard__doodles");
const preloader = document.querySelector("#preloader");

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
let resizeDebounceId = null;
let preloaderFinished = false;

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
const MAX_ANNOTATION_CHARS = 50;
const PREFERS_REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const PRELOADER_DURATION_MS = PREFERS_REDUCED_MOTION ? 380 : 3250;
const FORTUNE_STYLE_ANNOTATIONS = [
  "your luck changes after the next full moon.",
  "someone from your past will text this week.",
  "a secret crush is closer than you think.",
  "trust your first instinct this Friday night.",
  "money finds you after one brave decision.",
  "you are one yes away from a new chapter.",
  "an old dream returns with better timing.",
  "expect soft love and loud laughter soon.",
  "the next door opens when you stop forcing.",
  "a bold outfit brings a lucky encounter.",
  "your next trip will change your routine.",
  "you are protected while risking your heart.",
  "say no once and watch better things arrive.",
  "someone is manifesting you right now.",
  "your glow-up starts with one honest choice.",
  "a late-night call brings good news.",
  "you'll outgrow what once outgrew you.",
  "the answer appears after you rest.",
  "your creativity is about to pay rent.",
  "what feels delayed is being upgraded.",
  "a small gamble leads to a big payoff.",
  "your name is mentioned in the right room.",
  "someone kind helps you unexpectedly.",
  "your next beginning starts tomorrow morning.",
  "listen to your body before your calendar.",
  "you'll receive clarity in a random moment.",
  "the universe likes your latest plan.",
];
const DOODLE_ZONES = [
  {
    horizontalProp: "left",
    horizontalRange: [36, 50],
    verticalProp: "top",
    verticalRange: [10, 22],
    rotationRange: [-12, -4],
    widthRange: [10.4, 13.6],
  },
  {
    horizontalProp: "left",
    horizontalRange: [8, 20],
    verticalProp: "top",
    verticalRange: [52, 66],
    rotationRange: [-6, 6],
    widthRange: [11, 14.2],
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

function trimAnnotation(text, maxChars = MAX_ANNOTATION_CHARS) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const shortened = normalized.slice(0, maxChars - 3).trimEnd();
  return `${shortened}...`;
}

function rectsOverlap(a, b, padding = 10) {
  return !(
    a.x + a.width + padding < b.x ||
    b.x + b.width + padding < a.x ||
    a.y + a.height + padding < b.y ||
    b.y + b.height + padding < a.y
  );
}

function estimateRectForCandidate(candidate, zone, textLength, containerRect, rootFontSizePx) {
  const widthPx = candidate.widthRem * rootFontSizePx;
  const charsPerLine = Math.max(15, Math.floor(widthPx / (rootFontSizePx * 0.5)));
  const lineCount = Math.max(1, Math.ceil(textLength / charsPerLine));
  const lineHeightPx = rootFontSizePx * 0.78;
  const heightPx = lineCount * lineHeightPx + rootFontSizePx * 0.38;

  let x;
  let y;

  if (zone.horizontalProp === "left") {
    x = containerRect.width * (candidate.horizontalPercent / 100);
  } else {
    x = containerRect.width - containerRect.width * (candidate.horizontalPercent / 100) - widthPx;
  }

  if (zone.verticalProp === "top") {
    y = containerRect.height * (candidate.verticalPercent / 100);
  } else {
    y = containerRect.height - containerRect.height * (candidate.verticalPercent / 100) - heightPx;
  }

  return {
    x,
    y,
    width: widthPx,
    height: heightPx,
  };
}

function buildPlacementCandidate(zone, textLength, containerRect, rootFontSizePx) {
  const candidate = {
    horizontalPercent: randomInRange(zone.horizontalRange[0], zone.horizontalRange[1]),
    verticalPercent: randomInRange(zone.verticalRange[0], zone.verticalRange[1]),
    rotationDeg: randomInRange(zone.rotationRange[0], zone.rotationRange[1]),
    widthRem: randomInRange(zone.widthRange[0], zone.widthRange[1]),
  };

  candidate.rect = estimateRectForCandidate(candidate, zone, textLength, containerRect, rootFontSizePx);
  return candidate;
}

function buildFallbackCandidate(zone, textLength, containerRect, rootFontSizePx) {
  const candidate = {
    horizontalPercent: (zone.horizontalRange[0] + zone.horizontalRange[1]) / 2,
    verticalPercent: (zone.verticalRange[0] + zone.verticalRange[1]) / 2,
    rotationDeg: (zone.rotationRange[0] + zone.rotationRange[1]) / 2,
    widthRem: (zone.widthRange[0] + zone.widthRange[1]) / 2,
  };

  candidate.rect = estimateRectForCandidate(candidate, zone, textLength, containerRect, rootFontSizePx);
  return candidate;
}

function applyRandomizedAnnotations() {
  if (doodles.length === 0 || !doodleLayer) {
    return;
  }

  const containerRect = doodleLayer.getBoundingClientRect();
  if (containerRect.width < 1 || containerRect.height < 1) {
    return;
  }

  const rootFontSizePx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const annotationTexts = pickRandomUnique(FORTUNE_STYLE_ANNOTATIONS, doodles.length).map((annotation) =>
    trimAnnotation(annotation)
  );
  const occupiedRects = [];

  doodles.forEach((doodle, index) => {
    const textElement = doodle.querySelector(".doodle__text");
    const zone = DOODLE_ZONES[index % DOODLE_ZONES.length];
    const annotationText =
      annotationTexts[index] || trimAnnotation(FORTUNE_STYLE_ANNOTATIONS[index % FORTUNE_STYLE_ANNOTATIONS.length]);

    if (textElement) {
      textElement.textContent = annotationText;
    }

    doodle.style.left = "";
    doodle.style.right = "";
    doodle.style.top = "";
    doodle.style.bottom = "";

    let candidate = null;
    for (let attempt = 0; attempt < 35; attempt += 1) {
      const nextCandidate = buildPlacementCandidate(zone, annotationText.length, containerRect, rootFontSizePx);
      const hasCollision = occupiedRects.some((rect) => rectsOverlap(nextCandidate.rect, rect));
      if (!hasCollision) {
        candidate = nextCandidate;
        break;
      }
    }

    if (!candidate) {
      candidate = buildFallbackCandidate(zone, annotationText.length, containerRect, rootFontSizePx);
    }

    doodle.style[zone.horizontalProp] = `${candidate.horizontalPercent.toFixed(1)}%`;
    doodle.style[zone.verticalProp] = `${candidate.verticalPercent.toFixed(1)}%`;
    doodle.style.transform = `rotate(${candidate.rotationDeg.toFixed(1)}deg)`;
    doodle.style.maxWidth = `${candidate.widthRem.toFixed(2)}rem`;
    occupiedRects.push(candidate.rect);
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

function finishPreloader() {
  if (preloaderFinished) {
    return;
  }

  preloaderFinished = true;
  document.body.classList.add("is-ready");
  if (!preloader) {
    return;
  }

  preloader.classList.add("is-hidden");
  window.setTimeout(() => {
    preloader.remove();
  }, 500);
}

function runPreloaderSequence() {
  if (!preloader) {
    finishPreloader();
    return;
  }

  if (PREFERS_REDUCED_MOTION) {
    window.setTimeout(finishPreloader, PRELOADER_DURATION_MS);
    return;
  }

  const sequenceCard = preloader.querySelector(".preloader__card");
  if (sequenceCard) {
    sequenceCard.addEventListener("animationend", finishPreloader, { once: true });
  }

  // Safety timeout in case animation event does not fire.
  window.setTimeout(finishPreloader, PRELOADER_DURATION_MS);
}

postcard.addEventListener("pointerdown", onPointerDown);
postcard.addEventListener("pointermove", onPointerMove);
postcard.addEventListener("pointerup", onPointerUp);
postcard.addEventListener("pointercancel", onPointerCancel);
postcard.addEventListener("keydown", onKeyDown);
window.addEventListener("resize", () => {
  window.clearTimeout(resizeDebounceId);
  resizeDebounceId = window.setTimeout(() => {
    applyRandomizedAnnotations();
  }, 130);
});

postcardInner.style.transition = "none";
applyRandomizedAnnotations();
commitFaceState(false);

runPreloaderSequence();
