const creatorPostcard = document.querySelector("#creatorPostcard");
const creatorImage = document.querySelector("#creatorImage");
const creatorFortune = document.querySelector("#creatorFortune");
const creatorUploadInput = document.querySelector("#creatorUploadInput");

const SUPPORTED_UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/heic", "image/heif"]);
const SUPPORTED_UPLOAD_EXTENSIONS = [".png", ".jpg", ".jpeg", ".heic", ".heif"];
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
];

let activeUploadObjectUrl = null;

function pickRandomFortune() {
  const randomIndex = Math.floor(Math.random() * FORTUNES.length);
  return FORTUNES[randomIndex];
}

function setRandomFortune() {
  if (!creatorFortune) {
    return;
  }

  creatorFortune.textContent = pickRandomFortune();
}

function isSupportedUploadFile(file) {
  if (!file) {
    return false;
  }

  const fileName = file.name ? file.name.toLowerCase() : "";
  const hasSupportedExtension = SUPPORTED_UPLOAD_EXTENSIONS.some((extension) =>
    fileName.endsWith(extension)
  );
  const mimeType = file.type ? file.type.toLowerCase() : "";
  const hasSupportedMimeType = SUPPORTED_UPLOAD_TYPES.has(mimeType);

  return hasSupportedExtension || hasSupportedMimeType;
}

function openUploadPicker() {
  if (!creatorUploadInput) {
    return;
  }

  creatorUploadInput.value = "";
  creatorUploadInput.click();
}

function onCreatorPostcardKeyDown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  openUploadPicker();
}

function onUploadInputChange(event) {
  if (!creatorImage) {
    return;
  }

  const input = event.target;
  const selectedFile = input.files && input.files[0];
  if (!selectedFile) {
    return;
  }

  if (!isSupportedUploadFile(selectedFile)) {
    window.alert("Please upload a PNG, JPEG, or HEIC image.");
    input.value = "";
    return;
  }

  const nextObjectUrl = URL.createObjectURL(selectedFile);
  const testImage = new Image();

  testImage.onload = () => {
    if (activeUploadObjectUrl) {
      URL.revokeObjectURL(activeUploadObjectUrl);
    }
    activeUploadObjectUrl = nextObjectUrl;
    creatorImage.src = nextObjectUrl;
    creatorImage.alt = "Your uploaded postcard image";
    setRandomFortune();
  };

  testImage.onerror = () => {
    URL.revokeObjectURL(nextObjectUrl);
    window.alert("That image format is not supported by this browser. Try PNG or JPEG.");
  };

  testImage.src = nextObjectUrl;
}

window.addEventListener("beforeunload", () => {
  if (activeUploadObjectUrl) {
    URL.revokeObjectURL(activeUploadObjectUrl);
  }
});

if (creatorPostcard && creatorUploadInput) {
  creatorPostcard.addEventListener("click", openUploadPicker);
  creatorPostcard.addEventListener("keydown", onCreatorPostcardKeyDown);
  creatorUploadInput.addEventListener("change", onUploadInputChange);
}

setRandomFortune();
