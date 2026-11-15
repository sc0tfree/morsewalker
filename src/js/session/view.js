/**
 * Updates the displayed number of active stations.
 *
 * @param {number} numStations - The current count of active stations.
 */
export function updateActiveStations(numStations) {
  document.getElementById('activeStations').textContent = numStations;
}

/**
 * Updates whether the AGN action can be invoked for the current QSO.
 *
 * @param {boolean} enabled - Whether at least one selected exchange field can repeat.
 */
export function setAgnButtonEnabled(enabled) {
  document.getElementById('agnButton').disabled = !enabled;
}

/** Show a response hint, or clear it after the operator continues. */
export function setResponseFeedback(message = '') {
  const feedback = document.getElementById('responseFeedback');
  feedback.textContent = message;
  feedback.hidden = message === '';
}
