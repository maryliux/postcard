const postcard = document.querySelector("#postcard");
const postcardInner = document.querySelector("#postcardInner");

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
commitFaceState(false);
