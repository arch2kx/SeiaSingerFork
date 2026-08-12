# Seia size slider

## Problem

Seia's overlay is always rendered at a fixed 450px width (`content.ts`). There's no way to make her bigger or smaller without editing the extension source.

## Design

Add a `seiaSize` number to `chrome.storage.local`, defaulting to `450` (preserves current behavior for existing users). A 5-step range slider in the popup controls it, styled to match the existing "Show Seia" toggle switch. The content script reacts to it live, same pattern as the visibility toggle.

### Sizes

Five discrete overlay widths, selected by slider position (index 0-4):

| Index | 0 | 1 | 2 (default) | 3 | 4 |
|---|---|---|---|---|---|
| Width | 250px | 350px | 450px | 550px | 650px |

Index 2 (450px) matches the current hardcoded width, so existing users see no change until they move the slider.

### Storage

- Key: `seiaSize` (number, px value), default `450`.
- Read/written via `chrome.storage.local`, same as `thresholdDb` and `seiaEnabled`.

### Popup (`popup.html`, `styles.css`, `popup.ts`)

- New row directly below `.toggle-row`, e.g.:
  ```html
  <div class="size-row">
    <input type="range" id="seiaSizeSlider" min="0" max="4" step="1">
    <span class="toggle-label">Seia size</span>
  </div>
  ```
- No tick labels/marks under the track — bare slider + thumb, consistent with the minimal look of the toggle.
- Styling matches `.switch`/`.slider`: pill-shaped track, white circular thumb (same size/shadow/transition as `.switch .slider::before`), using `::-webkit-slider-runnable-track`/`-thumb` and `::-moz-range-track`/`-thumb`. Track fill uses the same two colors as the toggle (`rgb(255, 199, 80)` filled portion up to the thumb, `#ccc` beyond it), recomputed as an inline `background` (linear-gradient) on every `input` event so the fill tracks the thumb position.
- On popup open: read `seiaSize` (default 450) from storage, map to the nearest index in the size array (exact match expected in practice), set the slider's value to that index.
- On `input`: look up `SIZES[slider.valueAsNumber]` and write it to `chrome.storage.local`.

### Content script (`content.ts`)

- `createOverlay()` keeps its current inline default (`450px`) as the initial paint before storage loads, avoiding a flash of unsized content.
- New `loadSize(img)` function, mirroring `loadVisibility`:
  - On init: read `seiaSize` (default 450) and set `img.style.width = `${size}px``.
  - Add a `chrome.storage.onChanged` listener for `seiaSize` (mirroring the existing `thresholdDb`/`seiaEnabled` listeners) so resizing in the popup takes effect immediately on any open tab, no reload required.
- `img.style.height` stays `"auto"` — only width changes, aspect ratio is preserved.

## Out of scope

- No manifest or permission changes (`storage` is already granted).
- No changes to the animation/audio-capture logic.
- No per-site sizing — this is a single global size setting, same scope as the visibility toggle.
- No custom/freeform sizing beyond the 5 preset steps.
