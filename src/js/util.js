import { createMorsePlayer, updateAudioLock } from './audio.js';
import { getCallingStation } from './stationGenerator.js';
import { getInputs } from './inputs.js';

/**
 * Compares the source and query strings based on specific fuzzy match criteria.
 *
 * @param {string} source - The source string to compare against.
 * @param {string} query - The query string to compare with the source.
 * @returns {string} - "perfect", "partial", or "none" based on the match.
 */
export function compareStrings(source, query) {
  // Check for perfect match
  if (source === query) {
    // console.log("Perfect");
    return 'perfect';
  }
  // Check Criterion 1 (Start of String Match)
  if (criterion1(source, query)) {
    // console.log("Partial: Criterion 1");
    return 'partial';
  }
  // Check Criterion 2 (Middle or End of String Match)
  if (criterion2(source, query)) {
    // console.log("Partial: Criterion 2");
    return 'partial';
  }
  // Check Criterion 3 (Off by One Character)
  if (criterion3(source, query)) {
    // console.log("Partial: Criterion 3");
    return 'partial';
  }
  // Check Criterion 4 (Source is a Prefix of Query)
  if (criterion4(source, query)) {
    // console.log("Partial: Criterion 4");
    return 'partial';
  }
  // Check Criterion 5 (Partial Match with Two Initial Characters Matching and One Off-by-One)
  if (criterion5(source, query)) {
    // console.log("Partial: Criterion 5");
    return 'partial';
  }
  // If none of the criteria are met
  // console.log("None");
  return 'none';

  /**
   * Criterion 1: Start of String Match
   *
   * - **Conditions:**
   *   - Match of **1 character minimum**.
   *   - Query string **may not contain incorrect characters**.
   *   - Must match **at the start** of the source string.
   *
   * - **Examples:**
   *   - Source: "ABC", Query: "A"   => partial
   *   - Source: "ABC", Query: "Z"   => none
   *   - Source: "ABC", Query: "AX"  => none
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion1(source, query) {
    // The query length must be at least 1 and not exceed the source length
    if (query.length >= 1 && query.length <= source.length) {
      // Check each character in the query against the source
      for (let i = 0; i < query.length; i++) {
        if (source[i] !== query[i]) {
          return false; // Mismatch found
        }
      }
      return true; // All characters match at the start
    }
    return false;
  }

  /**
   * Criterion 2: Middle or End of String Match
   *
   * - **Conditions:**
   *   - Match of **2 consecutive characters minimum**.
   *   - Must match **in the middle or end** of the source string (not at the very start).
   *
   * - **Examples:**
   *   - Source: "ABC", Query: "BC" => partial
   *   - Source: "ABC", Query: "B"  => none
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion2(source, query) {
    // The query length must be at least 2 and not exceed the source length
    if (query.length >= 2 && query.length <= source.length) {
      // Start from index 1 to avoid matching at the start of the source string
      for (let i = 1; i <= source.length - query.length; i++) {
        const substr = source.substring(i, i + query.length);
        if (substr === query) {
          return true; // Found a match in the middle or end
        }
      }
    }
    return false;
  }

  /**
   * Criterion 3: Off by One Character
   *
   * - **Conditions:**
   *   - Match of **3 characters minimum** with the **4th character allowed to be off**.
   *   - At least **3 characters must match exactly**.
   *
   * - **Examples:**
   *   - Source: "ABCDE", Query: "BCZE" => partial
   *   - Source: "ABCDE", Query: "BCE"  => none
   *   - Source: "ABCDE", Query: "ABXD" => partial
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion3(source, query) {
    // The query length must be at least 4 and not exceed the source length
    if (query.length >= 4 && query.length <= source.length) {
      // Iterate through the source string to find potential matches
      for (let i = 0; i <= source.length - query.length; i++) {
        const substr = source.substring(i, i + query.length);
        let mismatches = 0;
        // Compare each character in the query with the substring
        for (let j = 0; j < query.length; j++) {
          if (substr[j] !== query[j]) {
            mismatches++;
            if (mismatches > 1) {
              break; // More than one mismatch, move to next substring
            }
          }
        }
        // Check if at least 3 characters match exactly
        if (mismatches <= 1 && query.length - mismatches >= 3) {
          return true; // Criteria met
        }
      }
    }
    return false;
  }

  /**
   * Criterion 4: Source is a Prefix of Query
   *
   * - **Conditions:**
   *   - The **source string matches the beginning** of the query string exactly.
   *   - The match must **cover the entire source string**.
   *   - The **query string may have additional characters** at the end.
   *
   * - **Examples:**
   *   - Source: "ABC", Query: "ABCD"  => partial
   *   - Source: "ABC", Query: "ABCDE" => partial
   *   - Source: "ABC", Query: "ABCX"  => partial
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion4(source, query) {
    // The source must be non-empty and shorter than the query
    if (source.length >= 1 && query.length > source.length) {
      // Check if the source matches the start of the query
      for (let i = 0; i < source.length; i++) {
        if (source[i] !== query[i]) {
          return false; // Mismatch found
        }
      }
      return true; // Source is a prefix of query
    }
    return false;
  }

  /**
   * Criterion 5: Partial Match with Two Initial Characters Matching and One Off-by-One
   *
   * - **Conditions:**
   *   - The query length must be at least 3.
   *   - The first two characters of the query must match the first two characters of the source exactly.
   *   - The third character in the query can differ from the source by one character.
   *   - Matches are checked specifically at the start of the source string.
   *
   * - **Examples:**
   *   - Source: "AB6ZZ", Query: "ABX"
   *     => 'A' matches 'A', 'B' matches 'B', and 'X' vs '6' is allowed as one mismatch.
   *     => returns true for partial.
   *
   * @param {string} source
   * @param {string} query
   * @returns {boolean}
   */
  function criterion5(source, query) {
    // The query must have at least 3 characters
    if (query.length < 3) {
      return false;
    }

    // Check if source has at least the length of the query
    if (source.length < query.length) {
      return false;
    }

    // Compare the first three characters:
    // First two must match exactly
    if (source[0] !== query[0] || source[1] !== query[1]) {
      return false;
    }

    // The third character can differ by one character (off-by-one)
    let mismatches = 0;
    for (let i = 0; i < query.length; i++) {
      if (source[i] !== query[i]) {
        mismatches++;
        if (mismatches > 1) {
          return false;
        }
      }
    }

    return true;
  }
}

// function runCompareStringTestCase(source, query, expectedResult) {
//   const result = compareStrings(source, query);
//   const passed = result === expectedResult;
//   console.log(`Source: "${source}", Query: "${query}" => Expected: "${expectedResult}", Got: "${result}" - ${passed ? "PASSED" : "FAILED"}`);
// }
//
// const testCases = [
//   // Perfect matches
//   {source: "ABC", query: "ABC", expected: "perfect"},
//   {source: "", query: "", expected: "perfect"},
//   {source: "A", query: "A", expected: "perfect"},
//
//   // Criterion 1 - Start of string match
//   {source: "ABC", query: "A", expected: "partial"},
//   {source: "ABC", query: "AB", expected: "partial"},
//   {source: "ABC", query: "AX", expected: "none"},
//   {source: "ABC", query: "ABX", expected: "none"},
//   {source: "ABC", query: "Z", expected: "none"},
//   {source: "ABC", query: "", expected: "none"},
//   {source: "ABCDE", query: "ABC", expected: "partial"},
//   {source: "ABCDE", query: "ABCD", expected: "partial"},
//
//   // Criterion 2 - Middle or End of String
//   {source: "ABC", query: "BC", expected: "partial"},
//   {source: "ABCDE", query: "CD", expected: "partial"},
//   {source: "ABCDE", query: "DE", expected: "partial"},
//   {source: "ABCDE", query: "AB", expected: "none"},
//   {source: "ABCDE", query: "B", expected: "none"},
//   {source: "ABCDE", query: "E", expected: "none"},
//   {source: "ABCDE", query: "ABCDE", expected: "perfect"},
//   {source: "ABCDE", query: "XYZ", expected: "none"},
//   {source: "ABCDE", query: "BCD", expected: "partial"},
//   {source: "ABCDE", query: "BCDE", expected: "partial"},
//
//   // Criterion 3 - Off by one character
//   {source: "ABCDE", query: "BCZE", expected: "partial"},
//   {source: "ABCDE", query: "BCE", expected: "none"},
//   {source: "ABCDE", query: "ABXD", expected: "partial"},
//   {source: "ABCDE", query: "ABXY", expected: "none"},
//   {source: "ABCDE", query: "ABCDE", expected: "perfect"},
//   {source: "ABCDE", query: "ABCXE", expected: "partial"},
//   {source: "ABCDE", query: "ABCDF", expected: "partial"},
//   {source: "ABCDE", query: "ABCD", expected: "partial"},
//   {source: "ABCDE", query: "ABXDE", expected: "partial"},
//   {source: "ABCDE", query: "ABXXE", expected: "none"},
//
//   // Criterion 4 - Source is Prefix of Query
//   {source: "ABC", query: "ABCD", expected: "partial"},
//   {source: "ABC", query: "ABCDE", expected: "partial"},
//   {source: "ABC", query: "ABCX", expected: "partial"},
//   {source: "ABC", query: "ABCDX", expected: "partial"},
//   {source: "AB", query: "ABCD", expected: "partial"},
//   {source: "", query: "A", expected: "none"},
//   {source: "ABC", query: "ABC", expected: "perfect"},
//
//   // Edge cases
//   {source: "ABCDE", query: "ABCDEFX", expected: "none"},
//   {source: "ABCDE", query: "ABCDEF", expected: "partial"},
//   {source: "ABCD", query: "ABCDE", expected: "partial"},
//   {source: "ABCCDE", query: "ABXDE", expected: "none"},
//   {source: "ABCD", query: "ABXY", expected: "none"},
//   {source: "ABCDE", query: "ABC", expected: "partial"},
//   {source: "ABCDE", query: "ABCD", expected: "partial"},
//   {source: "", query: "", expected: "perfect"},
//   {source: "", query: "AB", expected: "none"},
//   {source: "A", query: "A", expected: "perfect"},
//   {source: "A", query: "AB", expected: "partial"},
//   {source: "A", query: "B", expected: "none"},
// ];

// for (const testCase of testCases) {
//     runCompareStringTestCase(testCase.source, testCase.query, testCase.expected);
// }

/**
 * Generates a weighted random number based on the number of stations.
 * Lower-numbered stations have higher probabilities.
 *
 * @param {number} minStations - The minimum number of additional stations.
 * @param {number} maxStations - The maximum number of additional stations.
 * @returns {number} - A station count (1 to maxStations) based on weighted probability.
 */
export function weightedRandom(minStations, maxStations) {
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
    if (rand < cumulative[i]) return Math.max(minStations, i + 1); // Return 1-indexed station number, at least minStations
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
//     let station = weightedRandom(1, maxStations);
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
 * Normalize the volume levels of a collection of station objects and create Morse players for each.
 *
 * This function takes in an array of station objects, each containing at least a `volume` property
 * (a numeric value) and other station-specific properties (such as `callsign`). It calculates
 * the total volume of all stations combined. If the total volume exceeds 1, the function normalizes
 * all volumes so that the total does not surpass 1. This normalization ensures that multiple
 * stations can play audio simultaneously without any single station dominating the output.
 *
 * After computing the normalization factor (scaling factor), it adjusts each station's volume by
 * multiplying it by this factor. Then it creates a Morse player instance (`createMorsePlayer`) for
 * each station at the new normalized volume. The resulting array of station objects, each with a
 * `player` property containing the corresponding Morse player instance, is returned.
 *
 * @param {Array<Object>} stations - The array of station objects. Each station must have a `volume`
 *                                   property (number) and may include other properties such as `callsign`.
 * @returns {Array<Object>} The array of station objects with their volumes normalized and a `player`
 *                          instance created for each one.
 *
 * @example
 * const stations = [
 *   { callsign: 'ABC', volume: 0.7 },
 *   { callsign: 'XYZ', volume: 0.6 }
 * ];
 *
 * const normalized = normalizeStationGain(stations);
 * // If total volume (1.3) is greater than 1, volumes are scaled down.
 * // For example, ABC might now have a volume of 0.538 and XYZ might have 0.462
 * // Each station in `normalized` now includes a `player` property.
 */
export function normalizeStationGain(stations) {
  let normalizedStations = [];

  // Normalize the volumes
  let totalVolume = 0;
  for (let i = 0; i < stations.length; i++) {
    totalVolume += stations[i].volume;
  }
  // console.log(`Total volume: ${totalVolume}`);
  // if totalVolume > 1, normalize
  // Determine the scaling factor
  let scalingFactor = 1;
  if (totalVolume > 1) {
    scalingFactor = 1 / totalVolume;
  }
  // console.log(`Scaling factor: ${scalingFactor}`);

  for (let i = 0; i < stations.length; i++) {
    let callingStation = stations[i];
    let adjustedVolume = callingStation.volume * scalingFactor;
    // console.log(`Adjusting volume for ${callingStation.callsign} from ${callingStation.volume} to ${adjustedVolume}`);
    callingStation.player = createMorsePlayer(callingStation, adjustedVolume);
    normalizedStations.push(callingStation);
  }
  return normalizedStations;
}

/**
 * Responds by playing each station's Morse callsign after normalizing their volumes.
 *
 * Logs the callsigns, normalizes their volumes, and then uses each station's player
 * to play their callsign. The `audioLock` parameter controls the start timing of playback.
 *
 * @param {Array<Object>} stations - Stations to respond to, each with a `callsign` and `volume`.
 * @param {number} audioLock - Base time offset for playback start.
 */
export function respondWithAllStations(stations, audioLock) {
  let inputs = getInputs();

  // Ensure minWait is between 0 and 2, and maxWait is between 0 and 5
  const minDelay = Math.max(0, Math.min(inputs.minWait, 2));
  const maxDelay = Math.max(0, Math.min(inputs.maxWait, 5));

  console.log(
    '<-- Responding with stations: ' +
      stations.map((station) => station.callsign)
  );
  stations = normalizeStationGain(stations);
  for (let i = 0; i < stations.length; i++) {
    const randomDelay = minDelay + Math.random() * maxDelay;

    let responseTimer = stations[i].player.playSentence(
      stations[i].callsign,
      audioLock + randomDelay
    );
    updateAudioLock(responseTimer);
  }
}

/**
 * Adds new stations if the current count is below the maximum allowed.
 *
 * Uses a weighted random selection to determine how many new stations to add,
 * logs details about each new station, updates the total active station count,
 * and returns the updated array.
 *
 * @param {Array<Object>} stations - Current list of stations.
 * @param {Object} inputs - Configuration object containing `minStations` and `maxStations`.
 * @param {Number} chance - (0.0-1.0] chance of adding a new station joining if > minStations
 * @returns {Array<Object>} The updated list of stations.
 */
export function addStations(stations, inputs, chance) {
  if (stations.length >= inputs.minStations && chance < 1.0 && Math.random() > chance) {
    return stations
  }
  // If currentStations is too short, then add a weighted random between 1 and inputs.maxStations
  if (stations.length < inputs.maxStations) {
    // Use weightedRandom to determine the number of stations to add
    let numStations = weightedRandom(inputs.minStations - stations.length, inputs.maxStations - stations.length);
    console.log(`+ Adding ${numStations} stations...`);
    for (let i = 0; i < numStations; i++) {
      let callingStation = getCallingStation();
      printStation(callingStation);
      stations.push(callingStation);
    }
  }

  updateActiveStations(stations.length);

  return stations;
}

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

/**
 * Inserts a new row at the top of a specified HTML table body with provided data.
 *
 * @param {string} tableName - The ID of the HTML table element.
 * @param {number} index - A numeric index or sequence number.
 * @param {string} callsign - The callsign or identifier to display.
 * @param {string} wpm - The words per minute speed (and Farnsworth spacing) to display.
 * @param {number} attempts - The number of attempts to record.
 * @param {number} totalTime - The total time taken, displayed to two decimal places.
 * @param {string|null} [extra=null] - Optional additional information to include in a fifth cell.
 */
export function addTableRow(
  tableName,
  index,
  callsign,
  wpm,
  attempts,
  totalTime,
  extra = null
) {
  const table = document
    .getElementById(tableName)
    .getElementsByTagName('tbody')[0];

  // Create a new row at the top
  const newRow = table.insertRow(0);

  // Add cells and populate them
  newRow.insertCell(0).textContent = index;
  newRow.insertCell(1).textContent = callsign;
  newRow.insertCell(2).textContent = wpm;
  newRow.insertCell(3).textContent = attempts;
  newRow.insertCell(4).textContent = totalTime.toFixed(2);
  if (extra) {
    newRow.insertCell(5).innerHTML = extra;
  }

  // Update the summary row at the bottom
  updateSummaryRow(tableName, extra);
}

/**
 * Removes all rows from the specified table body.
 *
 * @param {string} tableName - The ID of the HTML table element.
 */
export function clearTable(tableName) {
  const tableBody = document
    .getElementById(tableName)
    .getElementsByTagName('tbody')[0];

  // Clear all rows in the table body
  while (tableBody.firstChild) {
    tableBody.removeChild(tableBody.firstChild);
  }
}

/**
 * Computes totals and averages for the current rows (excluding the very first row),
 * and inserts/updates a summary row at the bottom. If there are fewer than 2 data rows,
 * no summary row is shown.
 *
 * @param {string} tableName - The ID of the HTML table element.
 * @param {string|null} [extra=null] - Optional additional information to include in a fifth cell.
 */
function updateSummaryRow(tableName, extra = null) {
  const table = document.getElementById(tableName);
  const tableBody = table.getElementsByTagName('tbody')[0];

  // Remove any existing summary row
  const existingSummary = document.getElementById(tableName + '-summary');
  if (existingSummary) {
    existingSummary.remove();
  }

  // Gather row data
  let rows = Array.from(tableBody.rows);

  // If fewer than 2 rows, no summary row is meaningful
  // (we can't compute averages if we skip the first row and end up with nothing)
  if (rows.length < 2) {
    return;
  }

  const wpmValues = []; // Will store WPM strings
  const attemptsList = []; // Will store numeric attempts
  const timeList = []; // Will store total times

  for (const row of rows) {
    // WPM in cell[2], Attempts in cell[3], Time in cell[4]
    const wpmVal = row.cells[2].textContent;
    const attemptsVal = parseInt(row.cells[3].textContent, 10);
    const timeVal = parseFloat(row.cells[4].textContent);

    wpmValues.push(wpmVal);
    attemptsList.push(attemptsVal);
    timeList.push(timeVal);
  }

  const rowCount = rows.length;

  // --- Compute average attempts
  const sumAttempts = attemptsList.reduce((a, b) => a + b, 0);
  const avgAttempts = sumAttempts / rowCount;

  // --- Compute average total time
  const sumTime = timeList.reduce((a, b) => a + b, 0);
  const avgTime = sumTime / rowCount;

  // --- Compute average WPM (check if we have slashes)
  const hasSlash = wpmValues.some((val) => val.includes('/'));
  let finalWpm;

  if (hasSlash) {
    // Treat all as slash. If a row does not have '/', treat like "xx/xx"
    let sumWpm1 = 0;
    let sumWpm2 = 0;
    for (const val of wpmValues) {
      if (val.includes('/')) {
        const [part1, part2] = val.split('/');
        sumWpm1 += parseInt(part1, 10);
        sumWpm2 += parseInt(part2, 10);
      } else {
        const num = parseInt(val, 10);
        sumWpm1 += num;
        sumWpm2 += num;
      }
    }
    const avgWpm1 = sumWpm1 / rowCount;
    const avgWpm2 = sumWpm2 / rowCount;
    // Round or format as desired; here we use integers
    finalWpm = avgWpm1.toFixed(1) + ' / ' + avgWpm2.toFixed(1);
  } else {
    // All are single WPM
    const sumWpm = wpmValues.reduce((sum, val) => sum + parseInt(val, 10), 0);
    const avgWpm = sumWpm / rowCount;
    finalWpm = avgWpm.toFixed(1).toString();
  }

  // --- Insert the new summary row at the bottom
  const summaryRow = tableBody.insertRow(-1);
  summaryRow.id = tableName + '-summary';

  // Make everything in the summary row bold; add " total" to avgTime
  summaryRow.insertCell(0).innerHTML = ``;
  summaryRow.insertCell(1).innerHTML = `<strong>Avg</strong>`;
  summaryRow.insertCell(2).innerHTML = `<strong>${finalWpm}</strong>`;
  summaryRow.insertCell(3).innerHTML =
    `<strong>${avgAttempts.toFixed(1)}</strong>`;
  summaryRow.insertCell(4).innerHTML = `<strong>${avgTime.toFixed(2)}</strong>`;
  summaryRow.insertCell(5).innerHTML = ``;
}

/**
 * Updates the displayed number of active stations.
 *
 * @param {number} numStations - The current count of active stations.
 */
export function updateActiveStations(numStations) {
  document.getElementById('activeStations').textContent = numStations;
}
