/**
 * Updates basic statistics on page load.
 *
 * @param {string} currentMode - The initialized operating mode.
 * @param {HTMLInputElement} yourCallsign - User callsign input.
 */
export function submitStartupStats(currentMode, yourCallsign) {
  if (yourCallsign.value !== '') {
    fetch(`https://stats.${window.location.hostname}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: currentMode, callsign: yourCallsign.value }),
    }).catch((error) => {
      console.error('Failed to send CloudFlare stats.');
    });
  }
}
