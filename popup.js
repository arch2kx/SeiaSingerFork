"use strict";
// Default loudness (dB)
(function () {
    const DEFAULT_THRESHOLD_DB = -35;
    const input = document.getElementById("thresholdInput");
    const commandHint = document.getElementById("commandHint");
    // Firefox has no tabCapture or offscreen document API, so tab-audio capture
    // isn't possible there. Detect it directly on open rather than waiting for
    // the user to press the shortcut and get nothing.
    const captureSupported = typeof chrome.tabCapture !== "undefined" && typeof chrome.offscreen !== "undefined";
    if (!captureSupported && commandHint) {
        commandHint.textContent =
            "Firefox has no tab-audio API, so Seia listens to on-page video/audio elements directly instead — no shortcut needed, and some cross-origin players may not be detected.";
    }
    // Show the saved value if there is one(or be null) otherwise leave the field empty
    chrome.storage.local.get({ thresholdDb: null }, ({ thresholdDb }) => {
        if (thresholdDb !== null && input)
            input.value = String(thresholdDb);
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
    const seiaToggle = document.getElementById("seiaToggle");
    chrome.storage.local.get({ seiaEnabled: true }, ({ seiaEnabled }) => {
        if (seiaToggle)
            seiaToggle.checked = seiaEnabled;
    });
    seiaToggle?.addEventListener("change", () => {
        chrome.storage.local.set({ seiaEnabled: seiaToggle.checked });
    });
    // The Seia size slider has 5 preset overlay widths. DEFAULT_SIZE_INDEX is the fallback.
    const SEIA_SIZES = [130, 180, 250, 350, 450];
    const DEFAULT_SIZE_INDEX = 2;
    const DEFAULT_SIZE = SEIA_SIZES[DEFAULT_SIZE_INDEX] ?? 250;
    const seiaSizeSlider = document.getElementById("seiaSizeSlider");
    const seiaSizeFill = document.getElementById("seiaSizeFill");
    const SLIDER_THUMB_PX = 20;
    const SLIDER_FILL_GAP_PX = 3;
    function updateSliderFill(slider, fill) {
        const fraction = Number(slider.value) / (SEIA_SIZES.length - 1);
        const trackWidth = slider.offsetWidth || 120;
        const thumbRightEdgePx = SLIDER_THUMB_PX + fraction * (trackWidth - SLIDER_THUMB_PX);
        const fillPx = Math.min(trackWidth, thumbRightEdgePx + SLIDER_FILL_GAP_PX);
        fill.style.width = `${(fillPx / trackWidth) * 100}%`;
    }
    chrome.storage.local.get({ seiaSize: DEFAULT_SIZE }, ({ seiaSize }) => {
        if (!seiaSizeSlider || !seiaSizeFill)
            return;
        const index = SEIA_SIZES.indexOf(seiaSize);
        seiaSizeSlider.value = String(index === -1 ? DEFAULT_SIZE_INDEX : index);
        updateSliderFill(seiaSizeSlider, seiaSizeFill);
    });
    seiaSizeSlider?.addEventListener("input", () => {
        if (!seiaSizeFill)
            return;
        const index = Number(seiaSizeSlider.value);
        const size = SEIA_SIZES[index] ?? SEIA_SIZES[DEFAULT_SIZE_INDEX];
        if (size !== undefined) {
            chrome.storage.local.set({ seiaSize: size });
        }
        updateSliderFill(seiaSizeSlider, seiaSizeFill);
    });
})();
//# sourceMappingURL=popup.js.map