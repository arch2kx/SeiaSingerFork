
// Injects Seia as a fixed overlay pinned to the side of a tab
(function () {
const CONFIG = {
  // Loudness at/above where Seia starts singing
  thresholdDb: -35,

  // Milliseconds per animation frame
  frameMs: 10,

  // Keep singing through short quiet dips so she doesn't stutter on gaps (ms)
  quietGraceMs: 70,
};

// Chrome has tabCapture + offscreen documents, so background.js / offscreen.js
// does the audio analysis and relay db-level messages here. Firefox has
// neither, so as a fallback we hook <audio>/<video> elements on the page
// directly and analyse them locally with the same Web Audio API, which
// works identically in both browsers and needs no extension permission.
const captureSupported = typeof chrome.tabCapture !== "undefined" && typeof chrome.offscreen !== "undefined";

// Frame sequence layout
const INTRO_START = 1;  // Play 1 -> 29 once when she starts singing
const INTRO_END = 29;
const LOOP_HIGH = 29;  // Then bounce back and forth: 29 -> 22 -> 29 repeat
const LOOP_LOW = 22;

const frameUrl = (n: number) => chrome.runtime.getURL(`frames/${n}.png`);
const idleUrl = () => chrome.runtime.getURL("frames/seiaidle.png");

// Animation state
type AnimationState = {
  phase: "idle" | "intro" | "loop";  // Phases: "idle", "intro", "loop"
  frame: number;  // Current frame number (starts at 1)
  dir: -1 | 1;  // Loop direction: -1 counts down toward LOOP_LOW, +1 back up
  lastLoudTs: number;  // Timestamp of the most recent time we reached/passed thresholdDb
};

const state: AnimationState = {
  phase: "idle",
  frame: INTRO_START,
  dir: -1,
  lastLoudTs: 0,
};

// Build the overlay and add it to page
function createOverlay(): HTMLImageElement | null {
  // If it already exists don't do anything
  if (document.getElementById("seia-side-element")) return null;

  const img = document.createElement("img");
  img.id = "seia-side-element";
  img.src = idleUrl();

  img.style.position = "fixed";
  img.style.right = "0";
  img.style.bottom = "0";
  img.style.width = "450px";
  img.style.height = "auto";
  img.style.zIndex = "2147483647";  // Max z-index so nothing covers it
  img.style.pointerEvents = "none";  // Let clicks pass through to the page

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
function tick(img: HTMLImageElement) {
  // Not enough sound: idle
  if (!isSinging()) {
    if (state.phase !== "idle") {
      state.phase = "idle";
      img.src = idleUrl();
    }
    return;
  }

  // Just started singing: kick off the intro (1 - 29)
  if (state.phase === "idle") {
    state.phase = "intro";
    state.frame = INTRO_START;
  }

  // Loop through intro until it hits intro_end
  if (state.phase === "intro") {
    img.src = frameUrl(state.frame);
    state.frame++;

    // Loop back down
    if (state.frame > INTRO_END) {
      state.phase = "loop";
      state.frame = LOOP_HIGH - 1;
      state.dir = -1;
    }
    return;
  }

  // Bounce between LOOP_HIGH and LOOP_LOW afterwards
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

// Load user's saved threshold (set from the popup) and keep it in sync
function loadThreshold() {
  chrome.storage.local.get(
    { thresholdDb: CONFIG.thresholdDb },
    ({ thresholdDb }: { thresholdDb?: number }) => {
      if (typeof thresholdDb === "number") CONFIG.thresholdDb = thresholdDb;
    }
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.thresholdDb) {
      const next = changes.thresholdDb.newValue;
      if (typeof next === "number") CONFIG.thresholdDb = next;
    }
  });
}

// Show/hide the overlay based on the user's saved preference (default: visible)
function applyVisibility(img: HTMLImageElement, enabled: boolean) {
  img.style.display = enabled ? "" : "none";
}

// Load the user's saved visibility preference and keep it in sync live,
// so toggling in the popup takes effect immediately without a page reload.
function loadVisibility(img: HTMLImageElement) {
  chrome.storage.local.get(
    { seiaEnabled: true },
    ({ seiaEnabled }: { seiaEnabled?: boolean }) => {
      applyVisibility(img, seiaEnabled !== false);
    }
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.seiaEnabled) {
      applyVisibility(img, changes.seiaEnabled.newValue !== false);
    }
  });
}

// Shared by both the Chrome relay path and the Firefox local-analysis path
// Any db reading at/above the threshold counts as "singing".
function handleDbLevel(db: number | undefined) {
  if (typeof db === "number" && db >= CONFIG.thresholdDb) state.lastLoudTs = Date.now();
}

// Loudness updates relayed from the offscreen analyser (Chrome only)
function handleMessage(msg: { type: string; db?: number }) {
  if (msg.type === "db-level") handleDbLevel(msg.db);
}

// --- Firefox fallback ---
// 
// Same decibel math as offscreen.js, run locally against whatever
// <audio>/<video> elements exist on the page instead of the full tab.
// Caveat: if an element's source is cross-origin without CORS headers,
// the analyzer silently reads zeros even though playback keeps working.
function getDecibelLevel(analyser: AnalyserNode): number {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  analyser.getFloatFrequencyData(dataArray);
  let powerSum = 0;
  for (let i = 0; i < bufferLength; i++) {
    powerSum += Math.pow(10, (dataArray[i] ?? 0) / 10);
  }
  return 10 * Math.log10(powerSum);
}

const hookedElements = new WeakSet<HTMLMediaElement>();
let fallbackCtx: AudioContext | null = null;

function hookElement(el: HTMLMediaElement) {
  if (hookedElements.has(el)) return;
  hookedElements.add(el);

  if (!fallbackCtx) fallbackCtx = new AudioContext();
  const ctx = fallbackCtx;

  // Autoplay policy: the graph stays suspended until a user gesture,
  // which would otherwise silence the element the moment it's hooked.
  const resume = () => ctx.resume();
  document.addEventListener("click", resume, { once: true });
  document.addEventListener("keydown", resume, { once: true });
  ctx.resume();

  let source: MediaElementAudioSourceNode;
  try {
    source = ctx.createMediaElementSource(el);
  } catch {
    return;  // Element already routed through another audio graph
  }

  const analyser = ctx.createAnalyser();
  source.connect(analyser);
  source.connect(ctx.destination);  // Keep the element audible

  setInterval(() => handleDbLevel(getDecibelLevel(analyser)), 60);
}

function scanForMediaElements() {
  document.querySelectorAll("audio, video").forEach((el) => hookElement(el as HTMLMediaElement));
}

// Catch players that get added to the page after we first scan
// (single-page apps, lazily-loaded video, etc).
function watchForNewMediaElements() {
  const observer = new MutationObserver(() => scanForMediaElements());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function init() {
  const img = createOverlay();
  if (!img) return;  // Already injected on this page

  preloadFrames();
  loadThreshold();  // Pull the user's saved dB threshold and watch for changes
  loadVisibility(img);  // Pull the user's saved show/hide preference and watch for changes
  setInterval(() => tick(img), CONFIG.frameMs); // start animation handling

  if (captureSupported) {
    chrome.runtime.onMessage.addListener(handleMessage);  // Relay from offscreen.js
  } else {
    scanForMediaElements();
    watchForNewMediaElements();
  }
}

init();
})();
