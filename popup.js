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
})();
//# sourceMappingURL=popup.js.map