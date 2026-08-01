# Seia Visibility Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a popup toggle switch that shows/hides the Seia overlay on all tabs, live, without needing a page reload.

**Architecture:** A new `seiaEnabled` boolean in `chrome.storage.local` (default `true`). The popup reads/writes it via a checkbox styled as a pill switch. The content script reads it on init to set the overlay's initial visibility, and listens for `chrome.storage.onChanged` to update visibility live — mirroring the existing `thresholdDb` sync pattern already in `content.ts`.

**Tech Stack:** TypeScript compiled via `tsc` (see `tsconfig.json`), plain HTML/CSS popup, Chrome/Firefox WebExtension APIs (`chrome.storage.local`, `chrome.storage.onChanged`). No test framework exists in this repo — verification is `npm run build` (type-checks and emits `.js`) plus manual load-and-click testing in the browser.

## Global Constraints

- Use `chrome.storage.local` for persistence (already the pattern for `thresholdDb`) — works identically on Chrome and Firefox, no branching needed.
- Default value when unset: `seiaEnabled = true` (preserves current always-visible behavior for existing users).
- No manifest.json changes — `storage` permission is already granted.
- Follow existing code style: IIFE-wrapped files, no semicolon-less style changes, comments only where the "why" isn't obvious (matches existing `content.ts`/`popup.ts` commenting style).
- After editing any `.ts` file, run `npm run build` to regenerate the corresponding `.js` before manual testing — the extension loads the compiled `.js` files, not the `.ts` sources.

---

### Task 1: Popup markup and styling for the toggle switch

**Files:**
- Modify: `popup.html:26-28`
- Modify: `styles.css` (append new rules at end of file)

**Interfaces:**
- Produces: a checkbox input with `id="seiaToggle"` that Task 2's `popup.ts` reads/writes.

- [ ] **Step 1: Add the toggle markup to `popup.html`**

Find this section (lines 26-28):

```html
  </div>

  <div class="footer">
```

Replace it with:

```html
  </div>

  <div class="toggle-row">
    <label class="switch">
      <input type="checkbox" id="seiaToggle" checked>
      <span class="slider"></span>
    </label>
    <span class="toggle-label">Show Seia</span>
  </div>

  <div class="footer">
```

- [ ] **Step 2: Add toggle switch CSS to `styles.css`**

Append this to the end of `styles.css`:

```css
.toggle-row {
    margin-top: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.toggle-label {
    font-size: 13px;
    font-weight: bold;
    color: #333;
}

.switch {
    position: relative;
    display: inline-block;
    width: 38px;
    height: 22px;
}

.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.switch .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    border-radius: 22px;
    transition: background-color 0.15s ease;
}

.switch .slider::before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: #ffffff;
    border-radius: 50%;
    transition: transform 0.15s ease;
}

.switch input:checked + .slider {
    background-color: rgb(255, 199, 80);
}

.switch input:checked + .slider::before {
    transform: translateX(16px);
}
```

- [ ] **Step 3: Verify the popup renders correctly**

Run: `npm run build`
Expected: no output (tsc succeeds silently); this step doesn't touch `.ts` files but confirms the build still works after the HTML/CSS edit.

Open `popup.html` directly in a browser (e.g. `file:///.../SeiaSingerFork/popup.html`) or reload the unpacked extension and open the popup.
Expected: a pill-shaped toggle switch labeled "Show Seia" appears above the footer/profile row, defaulting to the "on" position (checked, accent-colored).

- [ ] **Step 4: Commit**

```bash
git add popup.html styles.css
git commit -m "Add Show Seia toggle switch markup and styling to popup"
```

---

### Task 2: Popup logic to read/write `seiaEnabled`

**Files:**
- Modify: `popup.ts` (append logic near the end of the IIFE, after the existing threshold-input block)

**Interfaces:**
- Consumes: `#seiaToggle` checkbox produced by Task 1.
- Produces: `seiaEnabled` boolean key in `chrome.storage.local`, consumed by Task 3's `content.ts`.

- [ ] **Step 1: Add the toggle read/write logic to `popup.ts`**

Current end of file (lines 22-34):

```typescript
// Show the saved value if there is one(or be null) otherwise leave the field empty
chrome.storage.local.get({ thresholdDb: null }, ({ thresholdDb }) => {
  if (thresholdDb !== null && input) input.value = String(thresholdDb);
});

// A blank field falls back to the default
input?.addEventListener("input", () => {
  const raw = input.value.trim();
  if (raw === "") {
    chrome.storage.local.set({ thresholdDb: DEFAULT_THRESHOLD_DB });
    return;
  }
  const value = Number(raw);
  if (!Number.isNaN(value)) {
    chrome.storage.local.set({ thresholdDb: value });
  }
});
})();
```

Replace the final `})();` line with the toggle logic followed by the closing `})();`:

```typescript
// Show the saved value if there is one(or be null) otherwise leave the field empty
chrome.storage.local.get({ thresholdDb: null }, ({ thresholdDb }) => {
  if (thresholdDb !== null && input) input.value = String(thresholdDb);
});

// A blank field falls back to the default
input?.addEventListener("input", () => {
  const raw = input.value.trim();
  if (raw === "") {
    chrome.storage.local.set({ thresholdDb: DEFAULT_THRESHOLD_DB });
    return;
  }
  const value = Number(raw);
  if (!Number.isNaN(value)) {
    chrome.storage.local.set({ thresholdDb: value });
  }
});

// Seia visibility toggle: defaults to on so existing users see no change
const seiaToggle = document.getElementById("seiaToggle") as HTMLInputElement | null;

chrome.storage.local.get({ seiaEnabled: true }, ({ seiaEnabled }) => {
  if (seiaToggle) seiaToggle.checked = seiaEnabled;
});

seiaToggle?.addEventListener("change", () => {
  chrome.storage.local.set({ seiaEnabled: seiaToggle.checked });
});
})();
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: no errors; `popup.js` is regenerated with the new logic (check `popup.js` was rewritten via `git diff --stat popup.js`).

Reload the unpacked extension, open the popup, toggle the switch off then on.
Expected: no console errors in the popup's devtools; toggling persists after closing and reopening the popup (state matches what you left it at).

- [ ] **Step 3: Commit**

```bash
git add popup.ts popup.js popup.js.map
git commit -m "Wire Show Seia toggle to chrome.storage.local in popup"
```

---

### Task 3: Content script reacts to `seiaEnabled`

**Files:**
- Modify: `content.ts:120-135` (add new functions after `loadThreshold`)
- Modify: `content.ts:207-221` (`init()`)

**Interfaces:**
- Consumes: `seiaEnabled` boolean from `chrome.storage.local`, written by Task 2's `popup.ts`.
- Produces: overlay `<img id="seia-side-element">` visibility toggling live via `display` style.

- [ ] **Step 1: Add `applyVisibility` and `loadVisibility` functions to `content.ts`**

Find this section (lines 120-135):

```typescript
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
```

Add immediately after it (before the `// Shared by both the Chrome relay path...` comment):

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

- [ ] **Step 2: Call `loadVisibility` from `init()`**

Find this section (lines 207-221):

```typescript
function init() {
  const img = createOverlay();
  if (!img) return;  // Already injected on this page

  preloadFrames();
  loadThreshold();  // Pull the user's saved dB threshold and watch for changes
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
1. Confirm Seia's idle image appears in the bottom-right corner by default (toggle defaults to on).
2. Open the popup, switch "Show Seia" off.
3. Expected: Seia disappears from the page immediately, with no reload.
4. Switch it back on.
5. Expected: Seia reappears immediately at whatever animation frame she'd be on (idle, since no audio is playing).
6. Open a second tab with the extension active, toggle off from the popup while that second tab is focused, then check the first tab.
7. Expected: Seia is hidden on the first tab too — `chrome.storage.onChanged` fires for all tabs, not just the active one.

- [ ] **Step 4: Commit**

```bash
git add content.ts content.js content.js.map
git commit -m "Hide/show Seia overlay live based on seiaEnabled storage flag"
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
- Fresh install (or `chrome.storage.local.clear()` in the extension's devtools console) → confirm Seia is visible by default (no `seiaEnabled` key set yet, defaults to `true`).

Expected: all checks pass, no console errors in the popup or page devtools.

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "Fix issues found during final Seia toggle verification pass"
```

(Skip this commit if Steps 1-3 required no changes.)
