# Seia Size Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-step range slider to the popup that resizes the Seia overlay on all tabs, live, without needing a page reload.

**Architecture:** A new `seiaSize` number in `chrome.storage.local` (default `450`, one of 5 preset px widths: 250/350/450/550/650). The popup exposes a `<input type="range" min="0" max="4">` styled to match the existing `.switch` toggle (same colors, pill shape, white circular thumb), storing the index-to-px mapping in `popup.ts`. The content script reads it on init to set the overlay's initial width, and listens for `chrome.storage.onChanged` to update it live — mirroring the existing `seiaEnabled`/`thresholdDb` sync pattern already in `content.ts`.

**Tech Stack:** TypeScript compiled via `tsc` (see `tsconfig.json`), plain HTML/CSS popup, Chrome/Firefox WebExtension APIs (`chrome.storage.local`, `chrome.storage.onChanged`). No test framework exists in this repo — verification is `npm run build` (type-checks and emits `.js`) plus manual load-and-click testing in the browser.

## Global Constraints

- Sizes: `[250, 350, 450, 550, 650]` px, indexed 0-4. Index 2 (450px) is the default — matches the current hardcoded overlay width, so existing users see no change.
- Storage key: `seiaSize` (number, px value), default `450`, using `chrome.storage.local` (already the pattern for `thresholdDb`/`seiaEnabled`) — works identically on Chrome and Firefox, no branching needed.
- No manifest.json changes — `storage` permission is already granted.
- No tick labels/marks under the slider track — bare slider + thumb only.
- Follow existing code style: IIFE-wrapped files, comments only where the "why" isn't obvious (matches existing `content.ts`/`popup.ts` commenting style).
- `tsconfig.json` has `noUncheckedIndexedAccess: true` — any array index access (e.g. `SEIA_SIZES[i]`) is typed `T | undefined` and needs an explicit fallback (`?? 450`), not a non-null assertion.
- After editing any `.ts` file, run `npm run build` to regenerate the corresponding `.js` before manual testing — the extension loads the compiled `.js` files, not the `.ts` sources.

---

### Task 1: Popup markup and styling for the size slider

**Files:**
- Modify: `popup.html:28-36`
- Modify: `styles.css` (append new rules at end of file)

**Interfaces:**
- Produces: a range input with `id="seiaSizeSlider"`, `min="0"`, `max="4"`, `step="1"`, default `value="2"`, that Task 2's `popup.ts` reads/writes.

- [ ] **Step 1: Add the slider markup to `popup.html`**

Find this section (lines 28-36):

```html
  <div class="toggle-row">
    <label class="switch">
      <input type="checkbox" id="seiaToggle" checked>
      <span class="slider"></span>
    </label>
    <span class="toggle-label">Show Seia</span>
  </div>

  <div class="footer">
```

Replace it with:

```html
  <div class="toggle-row">
    <label class="switch">
      <input type="checkbox" id="seiaToggle" checked>
      <span class="slider"></span>
    </label>
    <span class="toggle-label">Show Seia</span>
  </div>

  <div class="size-row">
    <input type="range" id="seiaSizeSlider" min="0" max="4" step="1" value="2">
    <span class="toggle-label">Seia size</span>
  </div>

  <div class="footer">
```

- [ ] **Step 2: Add size slider CSS to `styles.css`**

Append this to the end of `styles.css` (after the existing `.switch input:checked + .slider::before` rule):

```css
.size-row {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

#seiaSizeSlider {
    -webkit-appearance: none;
    appearance: none;
    width: 120px;
    height: 26px;
    border-radius: 22px;
    background: linear-gradient(to right, rgb(255, 199, 80) 50%, #ccc 50%);
    cursor: pointer;
    outline: none;
}

#seiaSizeSlider::-webkit-slider-runnable-track {
    -webkit-appearance: none;
    height: 26px;
    border-radius: 22px;
    background: transparent;
}

#seiaSizeSlider::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 20px;
    width: 20px;
    margin-top: 3px;
    border-radius: 50%;
    background-color: #ffffff;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.4);
    cursor: pointer;
}

#seiaSizeSlider::-moz-range-track {
    height: 26px;
    border-radius: 22px;
    background-color: #ccc;
}

#seiaSizeSlider::-moz-range-progress {
    height: 26px;
    border-radius: 22px 0 0 22px;
    background-color: rgb(255, 199, 80);
}

#seiaSizeSlider::-moz-range-thumb {
    height: 20px;
    width: 20px;
    border: none;
    border-radius: 50%;
    background-color: #ffffff;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.4);
    cursor: pointer;
}
```

Note on the styling approach: Chromium/WebKit has no native "filled track" pseudo-element, so the fill is done by setting `background` (a linear-gradient) directly on the `#seiaSizeSlider` element itself and making `::-webkit-slider-runnable-track` transparent so that gradient shows through. Firefox has a native `::-moz-range-progress` pseudo-element that fills natively, so no JS is needed there — the gradient set on the element in Task 2 is simply covered by the opaque `::-moz-range-track`/`::-moz-range-progress` pair and has no visible effect in Firefox, which is fine.

- [ ] **Step 3: Verify the popup renders correctly**

Run: `npm run build`
Expected: no output (tsc succeeds silently); this step doesn't touch `.ts` files but confirms the build still works after the HTML/CSS edit.

Open `popup.html` directly in a browser (e.g. `file:///.../SeiaSingerFork/popup.html`) or reload the unpacked extension and open the popup.
Expected: a pill-shaped slider labeled "Seia size" appears below the "Show Seia" toggle, with its thumb centered (50% fill) matching the toggle's color scheme (orange filled portion, gray remainder, white thumb).

- [ ] **Step 4: Commit**

```bash
git add popup.html styles.css
git commit -m "Add Seia size slider markup and styling to popup"
```

---

### Task 2: Popup logic to read/write `seiaSize`

**Files:**
- Modify: `popup.ts` (append logic near the end of the IIFE, after the existing `seiaToggle` block)

**Interfaces:**
- Consumes: `#seiaSizeSlider` range input produced by Task 1.
- Produces: `seiaSize` number key in `chrome.storage.local`, consumed by Task 3's `content.ts`.

- [ ] **Step 1: Add the size slider read/write logic to `popup.ts`**

Current end of file:

```typescript
// Seia visibility toggle: defaults to on so existing users see no change
const seiaToggle = document.getElementById("seiaToggle") as HTMLInputElement | null;

chrome.storage.local.get({ seiaEnabled: true }, ({ seiaEnabled }: { seiaEnabled: boolean }) => {
  if (seiaToggle) seiaToggle.checked = seiaEnabled;
});

seiaToggle?.addEventListener("change", () => {
  chrome.storage.local.set({ seiaEnabled: seiaToggle.checked });
});
})();
```

Replace the final `})();` line with the size slider logic followed by the closing `})();`:

```typescript
// Seia visibility toggle: defaults to on so existing users see no change
const seiaToggle = document.getElementById("seiaToggle") as HTMLInputElement | null;

chrome.storage.local.get({ seiaEnabled: true }, ({ seiaEnabled }: { seiaEnabled: boolean }) => {
  if (seiaToggle) seiaToggle.checked = seiaEnabled;
});

seiaToggle?.addEventListener("change", () => {
  chrome.storage.local.set({ seiaEnabled: seiaToggle.checked });
});

// Seia size slider: 5 preset overlay widths, index 2 (450px) is the default
// so existing users see no change until they move the slider.
const SEIA_SIZES = [250, 350, 450, 550, 650];
const seiaSizeSlider = document.getElementById("seiaSizeSlider") as HTMLInputElement | null;

// WebKit/Chromium has no native filled-track pseudo-element, so the orange
// fill is painted as a gradient on the input itself (see styles.css comment
// on ::-webkit-slider-runnable-track); recompute it whenever the value changes.
function updateSliderFill(slider: HTMLInputElement) {
  const percent = (Number(slider.value) / (SEIA_SIZES.length - 1)) * 100;
  slider.style.background = `linear-gradient(to right, rgb(255, 199, 80) ${percent}%, #ccc ${percent}%)`;
}

chrome.storage.local.get({ seiaSize: 450 }, ({ seiaSize }: { seiaSize: number }) => {
  if (!seiaSizeSlider) return;
  const index = SEIA_SIZES.indexOf(seiaSize);
  seiaSizeSlider.value = String(index === -1 ? 2 : index);
  updateSliderFill(seiaSizeSlider);
});

seiaSizeSlider?.addEventListener("input", () => {
  const index = Number(seiaSizeSlider.value);
  const size = SEIA_SIZES[index] ?? 450;
  chrome.storage.local.set({ seiaSize: size });
  updateSliderFill(seiaSizeSlider);
});
})();
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: no errors; `popup.js` is regenerated with the new logic (check `popup.js` was rewritten via `git diff --stat popup.js`).

Reload the unpacked extension, open the popup, drag the size slider across all 5 stops.
Expected: no console errors in the popup's devtools; the orange fill visibly tracks the thumb at each stop; after closing and reopening the popup, the slider is back at the position you left it (state persists).

- [ ] **Step 3: Commit**

```bash
git add popup.ts popup.js popup.js.map
git commit -m "Wire Seia size slider to chrome.storage.local in popup"
```

---

### Task 3: Content script reacts to `seiaSize`

**Files:**
- Modify: `content.ts:137-157` (add new functions after `loadVisibility`)
- Modify: `content.ts:229-244` (`init()`)

**Interfaces:**
- Consumes: `seiaSize` number from `chrome.storage.local`, written by Task 2's `popup.ts`.
- Produces: overlay `<img id="seia-side-element">` width resizing live via inline `style.width`.

- [ ] **Step 1: Add `applySize` and `loadSize` functions to `content.ts`**

Find this section (lines 137-157):

```typescript
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
```

Add immediately after it (before the `// Shared by both the Chrome relay path...` comment):

```typescript

// Apply the user's saved overlay width; height stays "auto" so the aspect ratio is preserved.
function applySize(img: HTMLImageElement, size: number) {
  img.style.width = `${size}px`;
}

// Load the user's saved size preference and keep it in sync live,
// so resizing in the popup takes effect immediately without a page reload.
function loadSize(img: HTMLImageElement) {
  chrome.storage.local.get(
    { seiaSize: 450 },
    ({ seiaSize }: { seiaSize?: number }) => {
      if (typeof seiaSize === "number") applySize(img, seiaSize);
    }
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.seiaSize) {
      const next = changes.seiaSize.newValue;
      if (typeof next === "number") applySize(img, next);
    }
  });
}
```

- [ ] **Step 2: Call `loadSize` from `init()`**

Find this section (lines 229-244):

```typescript
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
```

Replace with:

```typescript
function init() {
  const img = createOverlay();
  if (!img) return;  // Already injected on this page

  preloadFrames();
  loadThreshold();  // Pull the user's saved dB threshold and watch for changes
  loadVisibility(img);  // Pull the user's saved show/hide preference and watch for changes
  loadSize(img);  // Pull the user's saved size preference and watch for changes
  setInterval(() => tick(img), CONFIG.frameMs); // start animation handling

  if (captureSupported) {
    chrome.runtime.onMessage.addListener(handleMessage);  // Relay from offscreen.js
  } else {
    scanForMediaElements();
    watchForNewMediaElements();
  }
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: no type errors; `content.js` is regenerated (check via `git diff --stat content.js`).

Reload the unpacked extension on a real page (e.g. `https://www.youtube.com`):
1. Confirm Seia's idle image appears in the bottom-right corner at the default (450px-ish) size.
2. Open the popup, drag the size slider to the smallest stop.
3. Expected: Seia shrinks on the page immediately, with no reload.
4. Drag it to the largest stop.
5. Expected: Seia grows immediately, aspect ratio preserved (not stretched/squashed).
6. Open a second tab with the extension active, change the size from the popup while that second tab is focused, then check the first tab.
7. Expected: Seia resizes on the first tab too — `chrome.storage.onChanged` fires for all tabs, not just the active one.

- [ ] **Step 4: Commit**

```bash
git add content.ts content.js content.js.map
git commit -m "Resize Seia overlay live based on seiaSize storage value"
```

---

### Task 4: Final full-build sanity check

**Files:** none (verification only)

**Interfaces:** none — this task only confirms Tasks 1-3 integrate correctly.

- [ ] **Step 1: Full clean build**

Run: `npm run build`
Expected: exits with no errors, all `.js`/`.js.map`/`.d.ts` files up to date with their `.ts` sources.

- [ ] **Step 2: Lint the extension package**

Run: `npm run lint`
Expected: `web-ext lint` reports no new errors (pre-existing warnings, if any, are out of scope for this change).

- [ ] **Step 3: End-to-end manual pass**

Reload the unpacked extension fresh (remove and re-add it, or use the browser's reload-extension button) and repeat the checks from Task 3 Step 3 once more, plus:
- Fresh install (or `chrome.storage.local.clear()` in the extension's devtools console) → confirm Seia renders at the default (450px) size (no `seiaSize` key set yet, defaults to `450`) and the popup slider opens centered on the middle stop.
- Drag through all 5 stops in one popup session and confirm each stop produces a visibly different, correctly-ordered size on the page (smallest to largest, no stop skipped or reversed).

Expected: all checks pass, no console errors in the popup or page devtools.

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "Fix issues found during final Seia size slider verification pass"
```

(Skip this commit if Steps 1-3 required no changes.)
