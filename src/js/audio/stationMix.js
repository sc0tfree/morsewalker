import { createMorsePlayer, updateAudioLock } from '../audio.js';
import { getInputs } from '../inputs.js';

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
 * Each response receives a random delay between the configured minimum and maximum.
 * If the configured range is reversed, the minimum is used as a fixed safe delay.
 *
 * @param {Array<Object>} stations - Stations to respond to, each with a `callsign` and `volume`.
 * @param {number} audioLock - Base time offset for playback start.
 */
export function respondWithAllStations(stations, audioLock) {
  let inputs = getInputs();

  // Ensure minWait is between 0 and 2, and maxWait is between 0 and 5
  const minDelay = Math.max(0, Math.min(inputs.minWait, 2));
  const maxDelay = Math.max(0, Math.min(inputs.maxWait, 5));
  const delayRange = Math.max(0, maxDelay - minDelay);

  console.log(
    '<-- Responding with stations: ' +
      stations.map((station) => station.callsign)
  );
  stations = normalizeStationGain(stations);
  for (let i = 0; i < stations.length; i++) {
    const randomDelay = minDelay + Math.random() * delayRange;

    let responseTimer = stations[i].player.playSentence(
      stations[i].callsign,
      audioLock + randomDelay
    );
    updateAudioLock(responseTimer);
  }
}
