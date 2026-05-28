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
let showingBack = false;
let activePointerId = null;

const BASE_PITCH = 8;
const BASE_ROLL = -5;
const FRONT_YAW = -12;
const BACK_YAW = FRONT_YAW + 180;

const DRAG_YAW_SENSITIVITY = 0.42;
const DRAG_PITCH_SENSITIVITY = 0.28;
const DRAG_ROLL_SENSITIVITY = 0.08;
const MAX_PITCH_OFFSET = 34;
const MAX_ROLL_OFFSET = 16;

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

function commitFaceState(showBack) {
  showingBack = showBack;
  currentRotateY = showingBack ? BACK_YAW : FRONT_YAW;
  currentRotateX = BASE_PITCH;
  currentRotateZ = BASE_ROLL;
  postcardInner.style.transition = "transform 460ms cubic-bezier(0.22, 0.61, 0.36, 1)";
  renderTransform();
}

function onPointerDown(event) {
  activePointerId = event.pointerId;
  isDragging = true;
  moved = false;
  startX = event.clientX;
  startY = event.clientY;
  startRotateX = currentRotateX;
  startRotateY = currentRotateY;
  startRotateZ = currentRotateZ;
  postcard.classList.add("is-dragging");
  postcard.setPointerCapture(activePointerId);
  postcardInner.style.transition = "none";
}

function onPointerMove(event) {
  if (!isDragging || event.pointerId !== activePointerId) {
    return;
  }

  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;

  if (Math.hypot(deltaX, deltaY) > 4) {
    moved = true;
  }

  currentRotateY = startRotateY + deltaX * DRAG_YAW_SENSITIVITY;
  currentRotateX = clamp(
    startRotateX - deltaY * DRAG_PITCH_SENSITIVITY,
    BASE_PITCH - MAX_PITCH_OFFSET,
    BASE_PITCH + MAX_PITCH_OFFSET
  );
  currentRotateZ = clamp(
    startRotateZ + deltaX * DRAG_ROLL_SENSITIVITY,
    BASE_ROLL - MAX_ROLL_OFFSET,
    BASE_ROLL + MAX_ROLL_OFFSET
  );
  renderTransform();
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

  if (!moved) {
    commitFaceState(!showingBack);
    return;
  }

  const normalized = normalizeAngle(currentRotateY);
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

commitFaceState(false);
