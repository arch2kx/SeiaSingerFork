"use strict";
// Remember which tab we're capturing so we can send loudness updates back
// to that tab's content script (the offscreen doc doesn't know the tab id)
(function () {
    let capturedTabId = null;
    // Firefox has no tabCapture or offscreen document API (Mozilla has never
    // implemented tabCapture, and offscreen documents are Chrome-only), so tab
    // audio capture simply isn't possible there. Detect that once up front and
    // record it, instead of silently doing nothing when the command fires.
    const captureSupported = typeof chrome !== "undefined" && !!chrome.tabCapture && !!chrome.offscreen;
    chrome.commands.onCommand.addListener(async (command) => {
        if (command !== "seia-listen")
            return;
        if (!captureSupported) {
            // Let the popup know so it can explain why nothing happened,
            // instead of the user thinking the shortcut is broken.
            chrome.storage.local.set({ captureUnsupported: true });
            return;
        }
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab?.id)
            return;
        capturedTabId = tab.id;
        const streamId = await chrome.tabCapture.getMediaStreamId({
            targetTabId: tab.id,
        });
        // Create the offscreen document if it doesn't already exist
        const exists = await chrome.offscreen.hasDocument();
        if (!exists) {
            await chrome.offscreen.createDocument({
                url: "offscreen.html",
                reasons: ["USER_MEDIA"],
                justification: "Analyze captured tab audio to compute decibel level.",
            });
        }
        // Hand the stream ID to the offscreen document
        chrome.runtime.sendMessage({ type: "start-capture", streamId });
    });
    // The offscreen doc reports loudness readings so we relay them to the content
    // script running in the captured tab so it can drive Seia's animation.
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "db-level" && capturedTabId != null) {
            chrome.tabs
                .sendMessage(capturedTabId, { type: "db-level", db: msg.db })
                .catch(() => { }); // ignore if the content script isn't loaded there
        }
    });
})();
//# sourceMappingURL=background.js.map