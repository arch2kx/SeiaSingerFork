# Seia visibility toggle

## Problem

Seia's overlay always appears on every page once the extension is installed. There's no way to hide her without disabling the whole extension.

## Design

Add a `seiaEnabled` boolean to `chrome.storage.local`, defaulting to `true` (preserves current always-on behavior). A toggle switch in the popup controls it; the content script reacts to it live.

### Storage

- Key: `seiaEnabled` (boolean), default `true`.
- Read/written via `chrome.storage.local`, same as the existing `thresholdDb` setting. This API is identical on Chrome and Firefox, so no browser-specific branching is needed.

### Popup (`popup.html`, `styles.css`, `popup.ts`)

- Add a small pill-style toggle switch with a "Show Seia" label, placed near the footer/profile row (bottom of the popup).
- On popup open: read `seiaEnabled` from storage (default `true`) and set the switch's checked state.
- On toggle change: write the new boolean to `chrome.storage.local`.

### Content script (`content.ts`)

- On init: read `seiaEnabled` (default `true`) and set the overlay `<img>`'s `display` style accordingly (`""` when enabled, `"none"` when disabled).
- Add a `chrome.storage.onChanged` listener for `seiaEnabled` (mirroring the existing `thresholdDb` listener pattern) so toggling in the popup instantly shows/hides Seia on any open tab, no reload required.
- The animation `tick()` loop and audio-detection paths (both the Chrome offscreen-relay path and the Firefox on-page-element fallback) keep running unchanged; hiding is purely a display-level change. This keeps the diff minimal and avoids adding pause/resume logic to the animation state machine.

## Out of scope

- No manifest or permission changes (`storage` is already granted).
- No changes to the audio-capture/analysis logic.
- No per-site toggle — this is a single global on/off switch.
