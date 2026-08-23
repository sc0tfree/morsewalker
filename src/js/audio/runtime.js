// Audio lock
export let audioContext = new AudioContext();
export let audioLockUntil = 0;

/**
 * Updates the audio lock time.
 *
 * Prevents overlapping playback by ensuring no new audio can play
 * until after the specified lock time.
 *
 * @param {number} time - The new lock time in seconds.
 */
export function updateAudioLock(time) {
  if (time > audioLockUntil) {
    audioLockUntil = time;
  }
}

/**
 * Checks whether the audio lock is currently active.
 *
 * Compares the current audio context time with the lock time to determine
 * if new audio playback is allowed.
 *
 * @returns {boolean} True if the audio lock is active, false otherwise.
 */
export function getAudioLock() {
  return audioContext.currentTime < audioLockUntil;
}

export function resetAudioRuntime() {
  audioContext.close();
  audioContext = new AudioContext();
  audioLockUntil = 0;
}
