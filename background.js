// Remember which tab we're capturing so we can send loudness updates back
// to that tab's content script (the offscreen doc doesn't know the tab id)
let capturedTabId = null;

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "seia-listen") return;
  capturedTabId = tab.id;

  // Get a stream ID for the active tab
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

// The offscreen doc reports loudness readings so we relay them to the content script running in the captured tab so it can drive Seia's animation.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "db-level" && capturedTabId != null) {
    chrome.tabs
      .sendMessage(capturedTabId, { type: "db-level", db: msg.db })
      .catch(() => {}); // ignore if the content script isn't loaded there
  }
});