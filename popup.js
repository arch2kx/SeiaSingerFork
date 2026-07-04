// Default loudness (dB)
const DEFAULT_THRESHOLD_DB = -35;

const input = document.getElementById("thresholdInput");

// Show the saved value if there is one(or be null) otherwise leave the field empty
chrome.storage.local.get({ thresholdDb : null }, ({ thresholdDb }) => {
  if (thresholdDb !== null) input.value = thresholdDb;
});

// A blank field falls back to the default
input.addEventListener("input", () => {
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
