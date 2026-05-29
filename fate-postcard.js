const creatorPostcard = document.querySelector("#creatorPostcard");
const creatorPostcardInner = document.querySelector("#creatorPostcardInner");
const creatorFrontImage3d = document.querySelector("#creatorFrontImage3d");
const creatorFrontImage2d = document.querySelector("#creatorFrontImage2d");
const creatorFrontDrop3d = document.querySelector("#creatorFrontDrop3d");
const creatorFrontDrop2d = document.querySelector("#creatorFrontDrop2d");
const creatorStickerOverlay3d = document.querySelector("#creatorStickerOverlay3d");
const creatorStickerOverlay2d = document.querySelector("#creatorStickerOverlay2d");
const creatorView3d = document.querySelector("#creatorView3d");
const creatorView2d = document.querySelector("#creatorView2d");
const mode3dButton = document.querySelector("#mode3dButton");
const mode2dButton = document.querySelector("#mode2dButton");
const decorateToggleButton = document.querySelector("#decorateToggleButton");
const sheetStickers = Array.from(document.querySelectorAll(".creator__sheet-grid .creator__sticker"));
const actionBars = Array.from(document.querySelectorAll("[data-actions-bar]"));
const undoButtons = Array.from(document.querySelectorAll('[data-action="undo"]'));
const saveButtons = Array.from(document.querySelectorAll('[data-action="save"]'));
const fortuneSlotCount = 3;

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
let stickerPlacements = [];
let stickerIdCounter = 0;
let stickerDragState = null;

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
  const selected = pickRandomUnique(FORTUNES, fortuneSlotCount);
  selected.forEach((fortune, index) => {
    const slotNumber = index + 1;
    const slotElements = document.querySelectorAll(`[data-fortune-slot="${slotNumber}"]`);
    slotElements.forEach((element) => {
      element.textContent = fortune;
    });
  });
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function setActionsVisible(isVisible) {
  actionBars.forEach((bar) => {
    bar.hidden = !isVisible;
  });
}

function renderPlacedStickers() {
  const overlays = [creatorStickerOverlay3d, creatorStickerOverlay2d];
  overlays.forEach((overlay) => {
    if (!overlay) {
      return;
    }

    overlay.innerHTML = "";
    stickerPlacements.forEach((placement) => {
      const node = document.createElement("span");
      node.className = "creator__placed-sticker";
      node.textContent = placement.symbol;
      node.style.left = `${(placement.x * 100).toFixed(2)}%`;
      node.style.top = `${(placement.y * 100).toFixed(2)}%`;
      node.style.transform = `translate(-50%, -50%) rotate(${placement.rotation.toFixed(1)}deg) scale(${placement.scale.toFixed(2)})`;
      overlay.appendChild(node);
    });
  });
}

function getActiveFrontDropTarget() {
  return creatorView2d && !creatorView2d.hidden ? creatorFrontDrop2d : creatorFrontDrop3d;
}

function isPointInRect(clientX, clientY, rect) {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
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
  if (!creatorPostcard || creatorView3d?.hidden || stickerDragState) {
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
    mode3dButton.setAttribute("aria-pressed", String(is3d));
  }
  if (mode2dButton) {
    mode2dButton.classList.toggle("is-active", !is3d);
    mode2dButton.setAttribute("aria-pressed", String(!is3d));
  }

  if (!is3d) {
    isDragging = false;
    moved = false;
    releasePointerIfCaptured();
    activePointerId = null;
    if (creatorPostcard) {
      creatorPostcard.classList.remove("is-dragging");
    }
  }

  if (is3d) {
    commitFaceState(showingBack);
  }
}

function setDecorateSheetsOpen(isOpen) {
  document.body.classList.toggle("is-decorate-open", isOpen);
  if (!isOpen) {
    stopStickerDrag();
  }
  if (decorateToggleButton) {
    decorateToggleButton.classList.toggle("is-active", isOpen);
    decorateToggleButton.setAttribute("aria-pressed", String(isOpen));
  }
}

function onDecorateToggleClick() {
  const nextOpenState = !document.body.classList.contains("is-decorate-open");
  setDecorateSheetsOpen(nextOpenState);
}

function updateDragGhostPosition(clientX, clientY) {
  if (!stickerDragState || !stickerDragState.ghost) {
    return;
  }

  stickerDragState.ghost.style.left = `${clientX}px`;
  stickerDragState.ghost.style.top = `${clientY}px`;
}

function stopStickerDrag() {
  if (!stickerDragState) {
    return;
  }

  if (stickerDragState.ghost) {
    stickerDragState.ghost.remove();
  }

  window.removeEventListener("pointermove", onGlobalStickerPointerMove);
  window.removeEventListener("pointerup", onGlobalStickerPointerUp);
  window.removeEventListener("pointercancel", onGlobalStickerPointerUp);
  stickerDragState = null;
}

function tryPlaceStickerAtPoint(symbol, clientX, clientY) {
  const dropTarget = getActiveFrontDropTarget();
  if (!dropTarget) {
    return false;
  }

  const rect = dropTarget.getBoundingClientRect();
  if (!isPointInRect(clientX, clientY, rect)) {
    return false;
  }

  const x = clamp((clientX - rect.left) / rect.width, 0.02, 0.98);
  const y = clamp((clientY - rect.top) / rect.height, 0.02, 0.98);
  stickerPlacements.push({
    id: stickerIdCounter++,
    symbol,
    x,
    y,
    rotation: randomInRange(-17, 17),
    scale: randomInRange(0.94, 1.18),
  });
  renderPlacedStickers();
  setActionsVisible(stickerPlacements.length > 0);
  return true;
}

function onGlobalStickerPointerMove(event) {
  if (!stickerDragState) {
    return;
  }
  updateDragGhostPosition(event.clientX, event.clientY);
}

function onGlobalStickerPointerUp(event) {
  if (!stickerDragState || event.pointerId !== stickerDragState.pointerId) {
    return;
  }

  tryPlaceStickerAtPoint(stickerDragState.symbol, event.clientX, event.clientY);
  stopStickerDrag();
}

function onSheetStickerPointerDown(event) {
  if (!document.body.classList.contains("is-decorate-open")) {
    return;
  }

  const stickerNode = event.currentTarget;
  const symbol = stickerNode.textContent ? stickerNode.textContent.trim() : "";
  if (!symbol) {
    return;
  }

  event.preventDefault();
  stopStickerDrag();

  const ghost = document.createElement("span");
  ghost.className = "creator__drag-ghost";
  ghost.textContent = symbol;
  document.body.appendChild(ghost);

  stickerDragState = {
    symbol,
    pointerId: event.pointerId,
    ghost,
  };
  updateDragGhostPosition(event.clientX, event.clientY);

  window.addEventListener("pointermove", onGlobalStickerPointerMove);
  window.addEventListener("pointerup", onGlobalStickerPointerUp);
  window.addEventListener("pointercancel", onGlobalStickerPointerUp);
}

function onUndoStickersClick() {
  if (stickerPlacements.length === 0) {
    return;
  }

  stickerPlacements = stickerPlacements.slice(0, -1);
  renderPlacedStickers();
  setActionsVisible(stickerPlacements.length > 0);
}

function onSaveStickersClick() {
  if (stickerPlacements.length === 0) {
    return;
  }

  const sourceImageSrc = creatorFrontImage3d?.src || creatorFrontImage2d?.src;
  if (!sourceImageSrc) {
    return;
  }

  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1200;
    canvas.height = image.naturalHeight || 800;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const stickerFontSizePx = Math.max(22, Math.round(canvas.width * 0.048));
    context.font = `${stickerFontSizePx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    stickerPlacements.forEach((placement) => {
      context.save();
      context.translate(placement.x * canvas.width, placement.y * canvas.height);
      context.rotate((placement.rotation * Math.PI) / 180);
      context.scale(placement.scale, placement.scale);
      context.fillText(placement.symbol, 0, 0);
      context.restore();
    });

    const downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.download = "decorated-postcard.png";
    downloadLink.click();
  };

  image.onerror = () => {
    window.alert("Could not save this postcard image. Please try again.");
  };
  image.src = sourceImageSrc;
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

if (decorateToggleButton) {
  decorateToggleButton.addEventListener("click", onDecorateToggleClick);
}

sheetStickers.forEach((stickerNode) => {
  stickerNode.addEventListener("pointerdown", onSheetStickerPointerDown);
});

undoButtons.forEach((button) => {
  button.addEventListener("click", onUndoStickersClick);
});

saveButtons.forEach((button) => {
  button.addEventListener("click", onSaveStickersClick);
});

if (creatorPostcardInner) {
  creatorPostcardInner.style.transition = "none";
}

applyFrontImage();
setRandomFortunes();
renderPlacedStickers();
setActionsVisible(false);
commitFaceState(false);
setMode("3d");
setDecorateSheetsOpen(false);
if (creatorPostcardInner) {
  creatorPostcardInner.style.transition = "";
}
