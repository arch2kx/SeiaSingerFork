// Injects Seia as a fixed overlay pinned to the side of a tab
const CONFIG = {
  // Loudness at/above where Seia starts singing
  thresholdDb: -35,
  // Milliseconds per animation frame
  frameMs: 10,
  // Keep singing through short quiet dips so she doesn't stutter on gaps (ms)
  quietGraceMs: 70,
};

// Frame sequence layout
const INTRO_START = 1; // play 1 -> 29 once when she starts singing
const INTRO_END = 29;
const LOOP_HIGH = 29; // then bounce back and forth: 29 -> 22 -> 29 repeat
const LOOP_LOW = 22;

const frameUrl = (n) => chrome.runtime.getURL(`frames/${n}.png`);
const idleUrl = () => chrome.runtime.getURL("frames/seiaidle.png");

// Animation state
const state = {
  phase: "idle", // phases: "idle", "intro", "loop"
  frame: INTRO_START, // current frame number (starts at 1)
  dir: -1, // loop direction: -1 counts down toward LOOP_LOW, +1 back up
  lastLoudTs: 0, // timestamp of the most recent time we reached/passed thresholdDb
};

// Build the overlay and add it to the page
function createOverlay() {
  // if it alr exists dont do anything
  if (document.getElementById("seia-side-element")) return null;

  const img = document.createElement("img");
  img.id = "seia-side-element";
  img.src = idleUrl();

  img.style.position = "fixed";
  img.style.right = "0";
  img.style.bottom = "0";
  img.style.width = "380px";
  img.style.height = "auto";
  img.style.zIndex = "2147483647"; // max z-index so nothing covers it
  img.style.pointerEvents = "none"; // let clicks pass through to the page

  document.documentElement.appendChild(img);
  return img;
}

// Warm the browser cache so frame swaps don't flicker on first play
function preloadFrames() {
  for (let n = INTRO_START; n <= INTRO_END; n++) {
    new Image().src = frameUrl(n);
  }
}

const isSinging = () => Date.now() - state.lastLoudTs < CONFIG.quietGraceMs;

// One animation tick: advances the state machine and updates the image
function tick(img) {
  // Not enough sound: idle
  if (!isSinging()) {
    if (state.phase !== "idle") {
      state.phase = "idle";
      img.src = idleUrl();
    }
    return;
  }

  // Just started singing: kick off the intro(1-29)
  if (state.phase === "idle") {
    state.phase = "intro";
    state.frame = INTRO_START;
  }
  // loop through intro until we hit intro_end
  if (state.phase === "intro") {
    img.src = frameUrl(state.frame);
    state.frame++;
    // loop back down
    if (state.frame > INTRO_END) {
      state.phase = "loop";
      state.frame = LOOP_HIGH - 1;
      state.dir = -1;
    }
    return;
  }

  // bounce between LOOP_HIGH and LOOP_LOW afterwards
  img.src = frameUrl(state.frame);
  state.frame += state.dir;
  if (state.frame <= LOOP_LOW) {
    state.frame = LOOP_LOW;
    state.dir = 1;
  } else if (state.frame >= LOOP_HIGH) {
    state.frame = LOOP_HIGH;
    state.dir = -1;
  }
}

// Load the user's saved threshold (set from the popup) and keep it in sync
function loadThreshold() {
  chrome.storage.local.get({ thresholdDb : CONFIG.thresholdDb }, ({ thresholdDb }) => {
    if (typeof thresholdDb === "number") CONFIG.thresholdDb = thresholdDb;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.thresholdDb) {
      const next = changes.thresholdDb.newValue;
      if (typeof next === "number") CONFIG.thresholdDb = next;
    }
  });
}

// Loudness updates relayed from the offscreen analyser
function handleMessage(msg) {
  if (msg.type === "db-level" && typeof msg.db === "number") {
    if (msg.db >= CONFIG.thresholdDb) state.lastLoudTs = Date.now();
  }
}

function init() {
  const img = createOverlay();
  if (!img) return; // already injected on this page

  preloadFrames();
  loadThreshold(); // pull the user's saved dB threshold and watch for changes
  setInterval(() => tick(img), CONFIG.frameMs); // start animation handling
  chrome.runtime.onMessage.addListener(handleMessage); // start a message listener that calls handleMessage every time it gets a message
}

init();
