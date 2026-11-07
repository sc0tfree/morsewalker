import {
  resumeBackgroundStatic,
  stopBackgroundStatic,
} from './background-static.js';
import { audioContext, resetAudioRuntime } from './runtime.js';

/** Unlock both contexts within the same user gesture, without starting audio. */
export function resumeAllAudio() {
  const resumes = [
    () =>
      audioContext.state === 'running'
        ? Promise.resolve()
        : audioContext.resume(),
    resumeBackgroundStatic,
  ];

  // Do not await one context before requesting the other: Safari needs the
  // gesture for each. A failed attempt must also leave the next gesture usable.
  for (const resume of resumes) {
    try {
      void resume().catch((error) => {
        console.error('Error resuming audio:', error);
      });
    } catch (error) {
      console.error('Error resuming audio:', error);
    }
  }
}

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
