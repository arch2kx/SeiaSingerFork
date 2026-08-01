"use strict";
// Compute the current loudness of the tab audio in decibels
(function () {
    function getDecibelLevel(analyser) {
        // Number of frequency data points the analyser gives us
        const bufferLength = analyser.frequencyBinCount;
        // Byte array that will hold one snapshot of the frequency data
        const dataArray = new Float32Array(bufferLength);
        // Fill the array with the latest frequency values
        analyser.getFloatFrequencyData(dataArray);
        // Each element in the array is the decibel level in that hz range/bin
        let powerSum = 0;
        for (let i = 0; i < bufferLength; i++) {
            // 10^(L/10) converts each bin's dB back to linear power
            powerSum += Math.pow(10, (dataArray[i] ?? 0) / 10);
        }
        // Convert the total power back into decibels
        const totalDb = 10 * Math.log10(powerSum);
        return totalDb;
    }
    // Listen for messages coming from the service worker (background.js)
    chrome.runtime.onMessage.addListener(async (msg) => {
        // Ignore anything that isn't the start-capture command
        if (msg.type !== "start-capture")
            return;
        // Turn the tab capture stream ID into an actual audio MediaStream
        // For those who just came into the stream(haha get it), a mediastream is a browser object that represents a live stream of audio and/or video data
        // basically, we ask Chrome to start a new capture and it builds a stream for us
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    // Tell Chrome the media source is a tab
                    chromeMediaSource: "tab",
                    // The stream ID handed over by background.js identifies which tab
                    chromeMediaSourceId: msg.streamId,
                },
            },
        });
        // AudioContext is the engine that processes all the audio nodes
        const audioCtx = new AudioContext();
        // Wrap the captured stream so it can feed into the audio graph
        // MediaStream -> Audio Graph Node (basically just converting)
        // So we convert our current tab audio into a source node
        const source = audioCtx.createMediaStreamSource(stream);
        // AnalyserNode lets us read the audio data without altering it
        const analyser = audioCtx.createAnalyser();
        // Wire the tab audio into the analyser so it can be measured
        source.connect(analyser);
        // Keep the tab's audio audible
        // destination is the speakers, so this passes sound straight through
        source.connect(audioCtx.destination);
        setInterval(() => {
            const totalDb = getDecibelLevel(analyser);
            chrome.runtime.sendMessage({ type: "db-level", db: totalDb });
        }, 60);
    });
})();
//# sourceMappingURL=offscreen.js.map