import { getInputs } from '../inputs.js';

const backgroundStaticContext = new AudioContext();
const staticUrl = '../audio/static.mp3';
const fadeSeconds = 1;
const staticGainValues = {
  normal: 0.75,
  moderate: 1.5,
  heavy: 3.0,
};

let backgroundStaticSessionActive = false;
let currentTrack = null;
let nextTrackStartTime = 0;

/**
 * Disconnects the nodes owned by one QRN track.
 *
 * @param {object} track - The QRN track to disconnect.
 */
function disconnectTrack(track) {
  if (track.disconnected) return;

  if (track.source) {
    track.source.disconnect();
  }
  if (track.gain) {
    track.gain.disconnect();
  }
  track.disconnected = true;
}

/**
 * Loads and starts one QRN track if it is still the current request.
 *
 * @param {object} track - The QRN track request being loaded.
 * @returns {Promise<void>}
 */
async function loadTrack(track) {
  try {
    const response = await fetch(staticUrl);
    const arrayBuffer = await response.arrayBuffer();

    if (currentTrack !== track) return;

    const audioBuffer =
      await backgroundStaticContext.decodeAudioData(arrayBuffer);

    if (currentTrack !== track || !backgroundStaticSessionActive) return;

    const source = backgroundStaticContext.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;

    const gain = backgroundStaticContext.createGain();
    gain.gain.value = track.gainValue;

    source.connect(gain);
    gain.connect(backgroundStaticContext.destination);

    const currentTime = backgroundStaticContext.currentTime;
    const startTime = Math.max(currentTime, nextTrackStartTime);
    track.source = source;
    track.gain = gain;
    track.startTime = startTime;

    if (startTime > currentTime) {
      source.start(startTime);
    } else {
      source.start();
    }
  } catch (error) {
    if (currentTrack !== track) return;

    currentTrack = null;
    disconnectTrack(track);
    console.error('Error loading static audio file:', error);
  }
}

/**
 * Starts a QRN track for the selected level when the session wants QRN.
 */
function startSelectedTrack() {
  if (!backgroundStaticSessionActive || currentTrack) return;

  const inputs = getInputs();
  if (inputs === null || inputs.qrn === 'off') return;

  const selectedQRN = inputs.qrn;
  const track = {
    disconnected: false,
    gain: null,
    gainValue: staticGainValues[selectedQRN] || 1.0,
    source: null,
    startTime: null,
  };
  currentTrack = track;

  console.log(`/ Initializing background static for QRN level ${selectedQRN}`);
  void loadTrack(track);
}

/**
 * Retires the current track without changing session intent.
 *
 * A pending load is invalidated by detaching its token. A started track either
 * stops immediately or fades on the background context's own timeline.
 *
 * @param {boolean} noFade - If true, stops the current track immediately.
 */
function retireCurrentTrack(noFade) {
  const track = currentTrack;
  currentTrack = null;

  if (!track?.source || !track.gain) return;

  console.log('Stopping background static');

  const currentTime = backgroundStaticContext.currentTime;
  const hasNotStarted = track.startTime > currentTime;
  const fadeTime = noFade || hasNotStarted ? 0 : fadeSeconds;
  const fadeEnd = currentTime + fadeTime;
  nextTrackStartTime = Math.max(nextTrackStartTime, fadeEnd);

  track.gain.gain.setValueAtTime(track.gain.gain.value, currentTime);
  track.gain.gain.linearRampToValueAtTime(0, fadeEnd);

  if (fadeTime === 0) {
    track.source.stop(currentTime);
    disconnectTrack(track);
    return;
  }

  track.source.onended = () => disconnectTrack(track);
  track.source.stop(fadeEnd);
}

/**
 * Creates a background static noise track for QRN simulation.
 *
 * Configures a looping audio source based on the selected QRN level (e.g., normal, moderate, heavy).
 * Adjusts gain to match the QRN intensity and connects the source to the audio context.
 *
 * Ensures only one static track is active at a time.
 */
export function createBackgroundStatic() {
  backgroundStaticSessionActive = true;
  startSelectedTrack();
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
  backgroundStaticSessionActive = false;
  retireCurrentTrack(noFade);
}

/**
 * Checks whether a current background static track is loading or playing.
 *
 * A retired track that is only finishing its fade is not current.
 *
 * @returns {boolean} True if a current static track exists, false otherwise.
 */
export function isBackgroundStaticPlaying() {
  return currentTrack !== null;
}

/**
 * Updates the intensity of the background static noise.
 *
 * Stops any currently playing static noise and attempts to recreate it
 * with the updated QRN settings.
 */
export function updateStaticIntensity() {
  if (!backgroundStaticSessionActive) return;

  retireCurrentTrack(true);
  startSelectedTrack();
}
