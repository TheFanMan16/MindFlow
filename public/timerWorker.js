/* eslint-disable no-restricted-globals */

// This worker handles the timer tick on a separate thread to prevent throttling
// when the tab is inactive or minimized.

let timerInterval = null;
let endTime = null;
let isRunning = false;
let duration = 0;

self.onmessage = (e) => {
    const { action, payload } = e.data;

    switch (action) {
        case 'START':
            handleStart(payload);
            break;
        case 'PAUSE':
            handlePause();
            break;
        case 'RESET':
            handleReset(payload);
            break;
        case 'GET_TIME_LEFT':
            // allow querying current status
            postTimeLeft();
            break;
        default:
            break;
    }
};

function handleStart({ timeLeft }) {
    if (isRunning) return;

    // Calculate the target end time based on current time + remaining duration
    // We use Date.now() for absolute time reference
    const now = Date.now();
    endTime = now + (timeLeft * 1000);
    isRunning = true;

    // Clear any existing interval just in case
    if (timerInterval) clearInterval(timerInterval);

    // Immediate tick
    postTimeLeft();

    // Tick every second (1000ms)
    // We check Date.now() inside the interval to be self-correcting
    timerInterval = setInterval(() => {
        postTimeLeft();
    }, 1000);
}

function handlePause() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;

    // Calculate exact time left at pause moment to save state
    if (endTime) {
        const now = Date.now();
        const timeLeftSeconds = Math.max(0, Math.ceil((endTime - now) / 1000));
        // Send one last update with paused state
        self.postMessage({ type: 'TICK', timeLeft: timeLeftSeconds });
    }

    endTime = null;
}

function handleReset({ newTime }) {
    handlePause(); // Stop everything
    // Just emit the new time
    self.postMessage({ type: 'TICK', timeLeft: newTime });
}

function postTimeLeft() {
    if (!endTime) return;

    const now = Date.now();
    // Calculate remaining seconds
    // Math.ceil ensuring we don't hit 0 until we are actually past the time
    const timeLeftMs = endTime - now;
    const timeLeftSeconds = Math.max(0, Math.ceil(timeLeftMs / 1000));

    self.postMessage({ type: 'TICK', timeLeft: timeLeftSeconds });

    if (timeLeftSeconds <= 0) {
        // Timer complete
        handlePause(); // Stop the interval
        self.postMessage({ type: 'COMPLETE' });
    }
}
