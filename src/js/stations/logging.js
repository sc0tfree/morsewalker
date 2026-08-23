/**
 * Prints out a station's information in a formatted manner.
 *
 * @param {Object} station - The station object to display.
 */
export function printStation(station) {
  console.log('********************************');
  console.log(`Station: ${station.callsign}`);
  console.log('********************************');
  for (const key of Object.keys(station)) {
    console.log(` - ${key}: ${JSON.stringify(station[key], null, 2)},`);
  }
  console.log('================================');
}
