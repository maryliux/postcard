const postcard = document.querySelector("#postcard");
const postcardInner = document.querySelector("#postcardInner");

let isDragging = false;
let moved = false;
let startX = 0;
let startAngle = 0;
let currentAngle = 0;
let showingBack = false;
let activePointerId = null;

const DRAG_SENSITIVITY = 0.42;
const MIN_ANGLE = -35;
const MAX_ANGLE = 215;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(value) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function renderAngle() {
  postcardInner.style.transform = `rotateY(${currentAngle}deg)`;
}

function commitFaceState(showBack) {
  showingBack = showBack;
  currentAngle = showingBack ? 180 : 0;
  postcardInner.style.transition = "transform 480ms cubic-bezier(0.22, 0.61, 0.36, 1)";
  renderAngle();
}

function onPointerDown(event) {
  activePointerId = event.pointerId;
  isDragging = true;
  moved = false;
  startX = event.clientX;
  startAngle = currentAngle;
  postcard.classList.add("is-dragging");
  postcard.setPointerCapture(activePointerId);
  postcardInner.style.transition = "none";
}

function onPointerMove(event) {
  if (!isDragging || event.pointerId !== activePointerId) {
    return;
  }

  const deltaX = event.clientX - startX;
  if (Math.abs(deltaX) > 4) {
    moved = true;
  }

  currentAngle = clamp(startAngle + deltaX * DRAG_SENSITIVITY, MIN_ANGLE, MAX_ANGLE);
  renderAngle();
}

function onPointerUp(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  postcard.classList.remove("is-dragging");
  postcard.releasePointerCapture(activePointerId);
  isDragging = false;
  activePointerId = null;

  if (!moved) {
    commitFaceState(!showingBack);
    return;
  }

  const normalized = normalizeAngle(currentAngle);
  const shouldShowBack = normalized > 90 && normalized < 270;
  commitFaceState(shouldShowBack);
}

function onPointerCancel(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  postcard.classList.remove("is-dragging");
  postcard.releasePointerCapture(activePointerId);
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

renderAngle();
