/**
 * Updates the displayed number of active stations.
 *
 * @param {number} numStations - The current count of active stations.
 */
export function updateActiveStations(numStations) {
  document.getElementById('activeStations').textContent = numStations;
}
