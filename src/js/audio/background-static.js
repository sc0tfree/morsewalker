import { getInputs } from '../inputs.js';
import { audioContext, updateAudioLock } from './runtime.js';

let backgroundStaticSource = null;
let backgroundStaticContext = new AudioContext();
let staticGain = null;

/**
 * Creates a background static noise track for QRN simulation.
 *
 * Configures a looping audio source based on the selected QRN level (e.g., normal, moderate, heavy).
 * Adjusts gain to match the QRN intensity and connects the source to the audio context.
 *
 * Ensures only one static track is active at a time.
 */
export function createBackgroundStatic() {
  if (backgroundStaticSource) return; // Ensure only one static track is playing

  const inputs = getInputs();
  if (inputs === null) return; // Do not create static if inputs are invalid
  const selectedQRN = inputs.qrn;

  if (selectedQRN === 'off') {
    return; // Do not create static if "off" is selected
  }

  let staticGainValues = {
    normal: 0.75,
    moderate: 1.5,
    heavy: 3.0,
  };

  console.log(`/ Initializing background static for QRN level ${selectedQRN}`);

  const context = backgroundStaticContext;
  const staticUrl = '../audio/static.mp3';

  // Fetch and decode the audio file
  fetch(staticUrl)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
    .then((audioBuffer) => {
      backgroundStaticSource = context.createBufferSource();
      backgroundStaticSource.buffer = audioBuffer;
      backgroundStaticSource.loop = true;

      staticGain = context.createGain();
      staticGain.gain.value = staticGainValues[selectedQRN] || 1.0;

      backgroundStaticSource.connect(staticGain);
      staticGain.connect(context.destination);

      backgroundStaticSource.start();
    })
    .catch((error) => {
      console.error('Error loading static audio file:', error);
    });
}

/**
 * Stops the background static noise track.
 *
 * Optionally applies a fade-out effect before stopping the audio source. Disconnects
 * all related audio nodes and cleans up resources after stopping.
 *
 * @param {boolean} noFade - If true, stops the static immediately without fading.
 */
export function stopBackgroundStatic(noFade = false) {
  if (backgroundStaticSource) {
    console.log('Stopping background static');

    if (staticGain) {
      const fadeTime = noFade ? 0 : 1; // Fade out over 1 second
      const currentTime = backgroundStaticContext.currentTime;
      staticGain.gain.setValueAtTime(staticGain.gain.value, currentTime);
      staticGain.gain.linearRampToValueAtTime(0, currentTime + fadeTime);
      updateAudioLock(audioContext.currentTime + fadeTime);
    }

    if (noFade) {
      // Stop and clean up immediately
      backgroundStaticSource.stop();
      backgroundStaticSource.disconnect();
      staticGain.disconnect();
      backgroundStaticSource = null;
      staticGain = null;
    } else {
      // Stop after fade-out
      setTimeout(() => {
        if (backgroundStaticSource) {
          backgroundStaticSource.stop();
          backgroundStaticSource.disconnect();
        }
        if (staticGain) {
          staticGain.disconnect();
        }
        backgroundStaticSource = null;
        staticGain = null;
      }, 1000);
    }
  }
}

/**
 * Checks whether the background static noise is currently playing.
 *
 * @returns {boolean} True if the static noise source is active, false otherwise.
 */
export function isBackgroundStaticPlaying() {
  return backgroundStaticSource !== null;
}

/**
 * Updates the intensity of the background static noise.
 *
 * Stops any currently playing static noise and attempts to recreate it
 * with the updated QRN settings.
 */
export function updateStaticIntensity() {
  if (isBackgroundStaticPlaying()) {
    // Always stop any existing background static
    stopBackgroundStatic(true);
    // Attempt to create new background static
    createBackgroundStatic();
  }
}
