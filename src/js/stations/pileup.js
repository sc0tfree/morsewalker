import { getCallingStation } from '../stationGenerator.js';
import { updateActiveStations } from '../session/view.js';
import { printStation } from './logging.js';

/**
 * Generates a weighted random number based on the number of stations.
 * Lower-numbered stations have higher probabilities.
 *
 * @param {number} maxStations - The total number of stations.
 * @returns {number} - A station number (1 to maxStations) based on weighted probability.
 */
export function weightedRandom(maxStations) {
  // Step 1: Create weights inversely proportional to the station number
  let weights = [];
  for (let i = 1; i <= maxStations; i++) {
    weights.push(1 / i); // Higher weight for lower numbers
  }

  // Step 2: Normalize weights so they sum to 1
  let totalWeight = weights.reduce((a, b) => a + b, 0);
  weights = weights.map((w) => w / totalWeight);

  // Step 3: Generate a cumulative distribution from the weights
  let cumulative = [];
  weights.reduce((acc, w, i) => {
    cumulative[i] = acc + w; // Accumulate the probabilities
    return cumulative[i];
  }, 0);

  // Step 4: Generate a random number and find which station it corresponds to
  let rand = Math.random(); // Random number between 0 and 1
  for (let i = 0; i < cumulative.length; i++) {
    if (rand < cumulative[i]) return i + 1; // Return 1-indexed station number
  }

  // Fallback in case no station is selected (shouldn't happen)
  return maxStations;
}

// function testWeightedRandom() {
//   const maxStations = 10; // Test with 10 stations
//   const iterations = 10000; // Number of samples to collect
//   const results = Array(maxStations).fill(0); // Array to store counts for each station
//
//   // Collect results by running weightedRandom multiple times
//   for (let i = 0; i < iterations; i++) {
//     let station = weightedRandom(maxStations);
//     results[station - 1]++; // Increment the count for the returned station
//   }
//
//   // Display results
//   console.log(`Results after ${iterations} iterations with maxStations = ${maxStations}:`);
//   results.forEach((count, index) => {
//     console.log(`Station ${index + 1}: ${(count / iterations * 100).toFixed(2)}%`);
//   });
// }

// Run the test
// testWeightedRandom();

/**
 * Adds new stations if the current count is below the maximum allowed.
 *
 * Uses a weighted random selection to determine how many new stations to add,
 * logs details about each new station, updates the total active station count,
 * and returns the updated array.
 *
 * @param {Array<Object>} stations - Current list of stations.
 * @param {Object} inputs - Configuration object containing `maxStations`.
 * @returns {Array<Object>} The updated list of stations.
 */
export function addStations(stations, inputs) {
  // If currentStations is empty, then add a weighted random between 1 and inputs.maxStations
  if (stations.length < inputs.maxStations) {
    // Use weightedRandom to determine the number of stations to add
    let numStations = weightedRandom(inputs.maxStations - stations.length);
    console.log(`+ Adding ${numStations} stations...`);
    for (let i = 0; i < numStations; i++) {
      let callingStation = getCallingStation(inputs);
      printStation(callingStation);
      stations.push(callingStation);
    }
  }

  updateActiveStations(stations.length);

  return stations;
}
