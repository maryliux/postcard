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
const saveLayoutButtons = Array.from(document.querySelectorAll('[data-action="save-layout"]'));
const downloadPostcardButton = document.querySelector("#downloadPostcardButton");
const fortuneSlotCount = 3;

const UPLOAD_STORAGE_KEY = "uploadedPostcardFrontImage";
const STICKER_LAYOUT_STORAGE_KEY = "savedPostcardStickerLayout";
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
let hasUnsavedStickerChanges = false;
let lastSavedStickerPlacements = [];

function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

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

function cloneStickerPlacements(placements) {
  return placements.map((placement) => ({ ...placement }));
}

function setActionsVisible(isVisible = null) {
  const resolvedVisibility =
    isVisible === null
      ? document.body.classList.contains("is-decorate-open") && stickerPlacements.length > 0
      : isVisible;
  actionBars.forEach((bar) => {
    bar.hidden = !resolvedVisibility;
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
      node.dataset.placementId = String(placement.id);
      if (placement.type === "image" && placement.imageSrc) {
        const imageNode = document.createElement("img");
        imageNode.className = "creator__placed-sticker-image";
        imageNode.src = placement.imageSrc;
        imageNode.alt = "";
        imageNode.draggable = false;
        imageNode.style.pointerEvents = "none";
        node.appendChild(imageNode);
      } else {
        node.textContent = placement.symbol;
      }
      const leftBiasScale = 0.1 + placement.x * 0.9;
      const finalScale = placement.scale * leftBiasScale;
      node.style.left = `${(placement.x * 100).toFixed(2)}%`;
      node.style.top = `${(placement.y * 100).toFixed(2)}%`;
      node.style.transform = `translate(-50%, -50%) rotate(${placement.rotation.toFixed(1)}deg) scale(${finalScale.toFixed(2)})`;
      node.addEventListener("pointerdown", onPlacedStickerPointerDown);
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

function getStoredStickerLayout() {
  try {
    const rawValue = window.sessionStorage.getItem(STICKER_LAYOUT_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((placement) => placement && typeof placement === "object")
      .map((placement, index) => ({
        id: Number.isFinite(placement.id) ? placement.id : index,
        type: placement.type === "image" ? "image" : "emoji",
        symbol: typeof placement.symbol === "string" ? placement.symbol : "★",
        imageSrc: typeof placement.imageSrc === "string" ? placement.imageSrc : null,
        x: clamp(Number(placement.x), 0.02, 0.98),
        y: clamp(Number(placement.y), 0.02, 0.98),
        rotation: Number.isFinite(placement.rotation) ? placement.rotation : 0,
        scale: Number.isFinite(placement.scale) ? placement.scale : 1,
      }));
  } catch (error) {
    return [];
  }
}

function saveStickerLayoutToSession() {
  try {
    window.sessionStorage.setItem(STICKER_LAYOUT_STORAGE_KEY, JSON.stringify(stickerPlacements));
    return true;
  } catch (error) {
    return false;
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

  if (event.target instanceof Element && event.target.closest(".creator__placed-sticker")) {
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
  setActionsVisible();
}

function onDecorateToggleClick() {
  const isOpen = document.body.classList.contains("is-decorate-open");
  if (!isOpen) {
    setDecorateSheetsOpen(true);
    return;
  }

  if (hasUnsavedStickerChanges && stickerPlacements.length > 0) {
    const shouldDiscard = window.confirm(
      "You have unsaved sticker changes. Exit decorating mode without saving?"
    );
    if (!shouldDiscard) {
      return;
    }

    stickerPlacements = cloneStickerPlacements(lastSavedStickerPlacements);
    hasUnsavedStickerChanges = false;
    renderPlacedStickers();
  }

  setDecorateSheetsOpen(false);
}

function updateDragGhostPosition(clientX, clientY) {
  if (!stickerDragState || !stickerDragState.ghost) {
    return;
  }

  stickerDragState.ghost.style.left = `${clientX}px`;
  stickerDragState.ghost.style.top = `${clientY}px`;
}

function setPlacementDraggingState(placementId, isDragging) {
  const nodes = document.querySelectorAll(`.creator__placed-sticker[data-placement-id="${placementId}"]`);
  nodes.forEach((node) => {
    node.classList.toggle("is-dragging-placement", isDragging);
  });
}

function createDragGhost(stickerPayload) {
  const ghost = document.createElement("span");
  ghost.className = "creator__drag-ghost";

  if (stickerPayload.type === "image" && stickerPayload.imageSrc) {
    const imageNode = document.createElement("img");
    imageNode.className = "creator__drag-ghost-image";
    imageNode.src = stickerPayload.imageSrc;
    imageNode.alt = "";
    ghost.appendChild(imageNode);
  } else {
    ghost.textContent = stickerPayload.symbol;
  }

  return ghost;
}

function stopStickerDrag() {
  if (!stickerDragState) {
    return;
  }

  if (Number.isFinite(stickerDragState.fromPlacementId)) {
    setPlacementDraggingState(stickerDragState.fromPlacementId, false);
  }

  if (stickerDragState.ghost) {
    stickerDragState.ghost.remove();
  }

  window.removeEventListener("pointermove", onGlobalStickerPointerMove);
  window.removeEventListener("pointerup", onGlobalStickerPointerUp);
  window.removeEventListener("pointercancel", onGlobalStickerPointerUp);
  stickerDragState = null;
}

function tryPlaceStickerAtPoint(stickerPayload, clientX, clientY) {
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
    type: stickerPayload.type,
    symbol: stickerPayload.symbol,
    imageSrc: stickerPayload.imageSrc || null,
    x,
    y,
    rotation: randomInRange(-17, 17),
    scale: randomInRange(0.94, 1.18),
  });
  renderPlacedStickers();
  hasUnsavedStickerChanges = true;
  setActionsVisible();
  return true;
}

function movePlacedStickerAtPoint(placementId, clientX, clientY) {
  const dropTarget = getActiveFrontDropTarget();
  if (!dropTarget) {
    return false;
  }

  const rect = dropTarget.getBoundingClientRect();
  if (!isPointInRect(clientX, clientY, rect)) {
    return false;
  }

  const targetPlacement = stickerPlacements.find((placement) => placement.id === placementId);
  if (!targetPlacement) {
    return false;
  }

  targetPlacement.x = clamp((clientX - rect.left) / rect.width, 0.02, 0.98);
  targetPlacement.y = clamp((clientY - rect.top) / rect.height, 0.02, 0.98);
  renderPlacedStickers();
  hasUnsavedStickerChanges = true;
  setActionsVisible();
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

  if (Number.isFinite(stickerDragState.fromPlacementId)) {
    movePlacedStickerAtPoint(stickerDragState.fromPlacementId, event.clientX, event.clientY);
  } else {
    tryPlaceStickerAtPoint(stickerDragState, event.clientX, event.clientY);
  }
  stopStickerDrag();
}

function onPlacedStickerPointerDown(event) {
  const stickerNode = event.currentTarget;
  const placementId = Number(stickerNode.dataset.placementId);
  if (!Number.isFinite(placementId)) {
    return;
  }

  const placement = stickerPlacements.find((entry) => entry.id === placementId);
  if (!placement) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  stopStickerDrag();

  const ghost = createDragGhost(placement);
  document.body.appendChild(ghost);
  setPlacementDraggingState(placementId, true);

  stickerDragState = {
    type: placement.type,
    symbol: placement.symbol,
    imageSrc: placement.imageSrc || null,
    pointerId: event.pointerId,
    ghost,
    fromPlacementId: placementId,
  };
  updateDragGhostPosition(event.clientX, event.clientY);

  window.addEventListener("pointermove", onGlobalStickerPointerMove);
  window.addEventListener("pointerup", onGlobalStickerPointerUp);
  window.addEventListener("pointercancel", onGlobalStickerPointerUp);
}

function onSheetStickerPointerDown(event) {
  if (!document.body.classList.contains("is-decorate-open")) {
    return;
  }

  const stickerNode = event.currentTarget;
  const imageSrc = stickerNode.dataset.stickerImageSrc || "";
  const fallbackSymbol = stickerNode.dataset.stickerFallback || (stickerNode.textContent ? stickerNode.textContent.trim() : "");
  const useImage = Boolean(imageSrc && !stickerNode.classList.contains("is-image-missing"));
  const stickerPayload = {
    type: useImage ? "image" : "emoji",
    symbol: fallbackSymbol || "★",
    imageSrc: useImage ? imageSrc : null,
  };

  if (!stickerPayload.symbol && !stickerPayload.imageSrc) {
    return;
  }

  event.preventDefault();
  stopStickerDrag();

  const ghost = createDragGhost(stickerPayload);
  document.body.appendChild(ghost);

  stickerDragState = {
    ...stickerPayload,
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
  hasUnsavedStickerChanges = true;
  setActionsVisible();
}

function onSaveLayoutClick(event) {
  const didSave = saveStickerLayoutToSession();
  if (didSave) {
    lastSavedStickerPlacements = cloneStickerPlacements(stickerPlacements);
    hasUnsavedStickerChanges = false;
    setDecorateSheetsOpen(false);
  }
  const button = event.currentTarget;
  if (!button || !(button instanceof HTMLButtonElement)) {
    return;
  }

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent || "save";
  }

  button.textContent = didSave ? "saved!" : "retry";
  window.setTimeout(() => {
    button.textContent = button.dataset.originalLabel || "save";
  }, 880);
}

async function onSaveStickersClick() {
  const frontImageSrc = creatorFrontImage3d?.src || creatorFrontImage2d?.src;
  if (!frontImageSrc) {
    return;
  }

  try {
    const frontImage = await loadImageAsync(frontImageSrc);

    const frontWidth = frontImage.naturalWidth || 1200;
    const frontHeight = frontImage.naturalHeight || 800;

    const canvas = document.createElement("canvas");
    canvas.width = frontWidth;
    canvas.height = frontHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(frontImage, 0, 0, frontWidth, frontHeight);

    const stickerFontSizePx = Math.max(22, Math.round(frontWidth * 0.048));
    context.font = `${stickerFontSizePx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    const imageStickerPlacements = stickerPlacements.filter(
      (placement) => placement.type === "image" && placement.imageSrc
    );
    const uniqueImageSources = [...new Set(imageStickerPlacements.map((placement) => placement.imageSrc))];
    const loadedStickerImages = new Map();
    await Promise.all(
      uniqueImageSources.map(async (src) => {
        try {
          const stickerImage = await loadImageAsync(src);
          loadedStickerImages.set(src, stickerImage);
        } catch (error) {
          // Keep emoji fallback behavior for failed image loads.
        }
      })
    );

    stickerPlacements.forEach((placement) => {
      context.save();
      context.translate(placement.x * frontWidth, placement.y * frontHeight);
      context.rotate((placement.rotation * Math.PI) / 180);
      context.scale(placement.scale, placement.scale);
      if (placement.type === "image" && placement.imageSrc && loadedStickerImages.has(placement.imageSrc)) {
        const stickerImage = loadedStickerImages.get(placement.imageSrc);
        const baseSize = Math.max(26, Math.round(frontWidth * 0.04));
        context.drawImage(stickerImage, -baseSize / 2, -baseSize / 2, baseSize, baseSize);
      } else {
        context.fillText(placement.symbol, 0, 0);
      }
      context.restore();
    });

    const downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.download = "postcard-front.png";
    downloadLink.click();
  } catch (error) {
    window.alert("Could not save this postcard image. Please try again.");
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

if (decorateToggleButton) {
  decorateToggleButton.addEventListener("click", onDecorateToggleClick);
}

sheetStickers.forEach((stickerNode) => {
  const previewImage = stickerNode.querySelector(".creator__sticker-image");
  if (previewImage) {
    previewImage.addEventListener("error", () => {
      stickerNode.classList.add("is-image-missing");
    });
    previewImage.addEventListener("load", () => {
      stickerNode.classList.remove("is-image-missing");
    });
  }
  stickerNode.addEventListener("pointerdown", onSheetStickerPointerDown);
});

undoButtons.forEach((button) => {
  button.addEventListener("click", onUndoStickersClick);
});

saveLayoutButtons.forEach((button) => {
  button.addEventListener("click", onSaveLayoutClick);
});

if (downloadPostcardButton) {
  downloadPostcardButton.addEventListener("click", onSaveStickersClick);
}

if (creatorPostcardInner) {
  creatorPostcardInner.style.transition = "none";
}

applyFrontImage();
setRandomFortunes();
stickerPlacements = getStoredStickerLayout();
lastSavedStickerPlacements = cloneStickerPlacements(stickerPlacements);
hasUnsavedStickerChanges = false;
const maxPlacementId = stickerPlacements.reduce((maxId, placement) => Math.max(maxId, placement.id), -1);
stickerIdCounter = maxPlacementId + 1;
renderPlacedStickers();
setActionsVisible();
commitFaceState(false);
setMode("3d");
setDecorateSheetsOpen(false);
if (creatorPostcardInner) {
  creatorPostcardInner.style.transition = "";
}
