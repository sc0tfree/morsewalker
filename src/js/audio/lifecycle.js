import { stopBackgroundStatic } from './background-static.js';
import { resetAudioRuntime } from './runtime.js';

/**
 * Stops all audio playback and resets the audio context.
 *
 * Closes the current audio context, clears the audio lock, and stops
 * any active background static noise. Reinitializes a new audio context.
 */
export function stopAllAudio() {
  resetAudioRuntime();

  stopBackgroundStatic();
}
