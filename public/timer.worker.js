/* eslint-disable no-restricted-globals */
let timerInterval = null;
self.onmessage = (e) => {
  const { action, payload } = e.data;

  switch (action) {
    case 'START':
      if (timerInterval) clearInterval(timerInterval);
      let timeLeft = payload.timeLeft;
      timerInterval = setInterval(() => {
        timeLeft--;
        self.postMessage({ type: 'TICK', timeLeft });
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          self.postMessage({ type: 'COMPLETE' });
        }
      }, 1000);
      break;

    case 'PAUSE':
    case 'RESET':
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      break;
  }
};
