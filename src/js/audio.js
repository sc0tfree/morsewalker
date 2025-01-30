import {getInputs} from './inputs.js';


/**
 * Creates a Morse code audio player for a specified station.
 *
 * Configures an oscillator and gain node to produce audio signals representing
 * Morse code. Supports Farnsworth timing adjustments and simulates QSB (fading)
 * effects if enabled. Includes mappings for letters, numbers, punctuation, and
 * prosigns. Exposes a `playSentence` method for playing Morse sequences.
 *
 * @param {Object} station - The station configuration with attributes like volume, frequency, and WPM.
 * @param {number|null} volumeOverride - Optional override for the station's volume.
 * @returns {Object|null} An object with methods to play Morse sequences or null if inputs are invalid.
 */
export function createMorsePlayer(station, volumeOverride = null) {

  let volume = volumeOverride !== null ? volumeOverride : station.volume;

  const inputs = getInputs();
  if (inputs === null) return;

  const enableFarnsworth = station.enableFarnsworth;
  const farnsworthSpeed = station.farnsworthSpeed || station.wpm; // fallback if not set

  console.log(
    `/ Initializing ${station.callsign}: ${station.frequency}Hz@${station.wpm}wpm` +
    `${enableFarnsworth ? `/${station.farnsworthSpeed}wpm` : ''}` +
    ` vol: ${volume.toFixed(2)}` +
    `${station.qsb ? ` (QSB:${station.qsbDepth.toFixed(2)}A@${station.qsbFrequency.toFixed(2)}Hz)` : ''}`
  );


  let context = audioContext;

  // QSB parameters
  const qsb = station.qsb === true;
  const qsbDepth = qsb ? station.qsbDepth : 0;
  const qsbFrequency = qsb ? station.qsbFrequency : 0;
  const stationStartTime = context.currentTime;
  // Introduce a random phase offset for QSB so multiple stations differ
  const qsbPhaseOffset = qsb ? Math.random() * 2 * Math.PI : 0;

  // Calculate timing constants in seconds
  // Character speed unit (from station's wpm)
  const CHAR_UNIT = 1.2 / station.wpm;
  // Farnsworth speed unit (if enabled, otherwise just station speed)
  const FARNS_UNIT = 1.2 / farnsworthSpeed;

  // Dot/Dash and symbol spacing use character speed
  const DOT_TIME = CHAR_UNIT;
  const DASH_TIME = CHAR_UNIT * 3;
  const SYMBOL_SPACE = CHAR_UNIT;

  // Letter and word spacing change if Farnsworth is enabled
  const LETTER_SPACE = enableFarnsworth ? FARNS_UNIT * 3 : CHAR_UNIT * 3;
  const WORD_SPACE = enableFarnsworth ? FARNS_UNIT * 7 : CHAR_UNIT * 7;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = station.frequency;
  gainNode.gain.value = 0; // Start with no volume
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();

  // Morse code mapping including prosigns
  const morseCodeMap = {
    // Letters
    'a': '.-',
    'b': '-...',
    'c': '-.-.',
    'd': '-..',
    'e': '.',
    'f': '..-.',
    'g': '--.',
    'h': '....',
    'i': '..',
    'j': '.---',
    'k': '-.-',
    'l': '.-..',
    'm': '--',
    'n': '-.',
    'o': '---',
    'p': '.--.',
    'q': '--.-',
    'r': '.-.',
    's': '...',
    't': '-',
    'u': '..-',
    'v': '...-',
    'w': '.--',
    'x': '-..-',
    'y': '-.--',
    'z': '--..',
    // Numbers
    '0': '-----',
    '1': '.----',
    '2': '..---',
    '3': '...--',
    '4': '....-',
    '5': '.....',
    '6': '-....',
    '7': '--...',
    '8': '---..',
    '9': '----.',
    // Punctuation
    '.': '.-.-.-',
    ',': '--..--',
    '?': '..--..',
    '/': '-..-.',
    // Prosigns
    '<bk>': '-...-.-',
    '<ar>': '.-.-.',
    '<sk>': '...-.-',
    '<kn>': '-.--.',
    '<bt>': '-...-'
  };

  /**
   * Tokenizes a string into individual Morse code symbols and prosigns.
   *
   * Identifies prosigns enclosed in angle brackets (e.g., `<ar>`) and treats
   * them as distinct tokens. Splits the string into recognizable Morse components.
   *
   * @param {string} text - The text to tokenize.
   * @returns {string[]} An array of tokens representing Morse code symbols and prosigns.
   */
  function tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      if (text[i] === '<') {
        // Start of a prosign
        const endIndex = text.indexOf('>', i);
        if (endIndex !== -1) {
          tokens.push(text.substring(i, endIndex + 1));
          i = endIndex + 1;
        } else {
          // No closing '>', treat '<' as a normal character
          tokens.push(text[i]);
          i++;
        }
      } else if (text[i] === ' ') {
        tokens.push(' ');
        i++;
      } else {
        tokens.push(text[i]);
        i++;
      }
    }
    return tokens;
  }

  /**
   * Calculates the amplitude of a signal at a given time with optional QSB (fading) effects.
   *
   * Models QSB (fading) by oscillating the volume between full (no attenuation) and a reduced level
   * (attenuated by `qsbDepth`). The amplitude is calculated using a sine wave function:
   *
   *     amplitude(t) = volume * [1 - qsbDepth * ((sin(2π * qsbFrequency * (t - stationStartTime) + qsbPhaseOffset) + 1) / 2)]
   *
   * - `volume` is the base amplitude of the signal.
   * - `qsbDepth` determines the range of attenuation, where 0 means no fading and 1 means full fade.
   * - `qsbFrequency` defines the speed of the fading in Hz.
   * - `stationStartTime` anchors the time, ensuring consistent phase behavior for multiple stations.
   * - `qsbPhaseOffset` introduces a random phase offset to differentiate the behavior of overlapping signals.
   * - The sine function oscillates between -1 and 1, which is normalized to a range of 0 to 1.
   *
   * This function returns the adjusted amplitude based on the QSB parameters at the given time.
   * If QSB is disabled, it simply returns the base volume.
   *
   * @param {number} t - The current time in seconds.
   * @returns {number} The adjusted amplitude considering QSB effects.
   */
  function qsbAmplitude(t) {
    if (!qsb) return volume;
    const sineValue = Math.sin(2 * Math.PI * (t - stationStartTime) + qsbPhaseOffset);
    const fadeFactor = (sineValue + 1) / 2; // Maps sin(-1..1) to 0..1
    const qsbFactor = 1 - qsbDepth * fadeFactor;
    return volume * qsbFactor;
  }

  /**
   * Schedules playback of a single Morse code symbol (dot or dash) with smooth volume ramps for pleasing tones.
   *
   * This function schedules the gain node to create a smooth attack and release for the symbol's volume,
   * ensuring a natural sound. The process involves:
   *
   * - **Attack**: Gradually increases the volume from a minimum value (`minGain`) to the desired volume
   *   over a small fraction of the symbol's duration (`attackFraction`). This eliminates harsh clicks
   *   at the start of the tone.
   * - **Sustain**: Holds the volume steady for the majority of the symbol's duration.
   * - **Release**: Gradually decreases the volume back to a minimum over another fraction of the symbol's
   *   duration (`releaseFraction`), avoiding abrupt stops.
   *
   * The attack and release times are calculated as:
   *
   *     attackTime = min(duration * attackFraction, maxAttackReleaseTime)
   *     releaseTime = min(duration * releaseFraction, maxAttackReleaseTime)
   *
   * The total duration of the symbol is determined by its type:
   * - A dot (`.`) has a duration of `DOT_TIME`.
   * - A dash (`-`) has a duration of `DASH_TIME`.
   *
   * Additionally, the function samples the QSB amplitude at the middle of the attack phase (`time + attackTime`)
   * to set the volume dynamically based on the station's QSB configuration.
   *
   * Key steps in the playback:
   * 1. Volume ramps up from `minGain` to the target amplitude during the attack phase.
   * 2. Volume holds steady at the target amplitude during the sustain phase.
   * 3. Volume ramps down from the target amplitude back to `minGain` during the release phase.
   * 4. Ensures the gain returns to zero (`0`) shortly after the release for silence between symbols.
   *
   * @param {string} symbol - The Morse code symbol to play (`.` for dot or `-` for dash).
   * @param {number} time - The start time for the symbol in seconds.
   * @returns {number} The updated time after the symbol is played, including its duration.
   */
  function playSymbol(symbol, time) {
    const duration = symbol === '-' ? DASH_TIME : DOT_TIME;
    const minGain = 0.001; // Minimum gain to avoid zero in exponential ramp

    // Calculate attack and release times as a fraction of the symbol duration
    const attackFraction = 0.1;
    const releaseFraction = 0.1;
    const maxAttackReleaseTime = 0.01; // 10 ms max

    const attackTime = Math.min(duration * attackFraction, maxAttackReleaseTime);
    const releaseTime = Math.min(duration * releaseFraction, maxAttackReleaseTime);

    // Determine the amplitude at the start of the symbol considering QSB
    // We'll sample the QSB amplitude at time + attackTime for a stable ramp target
    const symbolMidTime = time + attackTime;
    const symbolVolume = qsbAmplitude(symbolMidTime);

    // Schedule gain to ramp up smoothly (attack)
    gainNode.gain.setValueAtTime(minGain, time);
    gainNode.gain.exponentialRampToValueAtTime(symbolVolume, symbolMidTime);

    // Maintain the gain at the desired volume
    gainNode.gain.setValueAtTime(symbolVolume, symbolMidTime);
    gainNode.gain.setValueAtTime(symbolVolume, time + duration - releaseTime);

    // Schedule gain to ramp down smoothly (release)
    gainNode.gain.exponentialRampToValueAtTime(minGain, time + duration);

    // Ensure gain goes back to zero after release
    gainNode.gain.setValueAtTime(0, time + duration + 0.001);

    return time + duration;
  }

  /**
   * Plays a sequence of Morse code symbols.
   *
   * Iterates through each symbol in the code, playing dots and dashes with proper
   * spacing. Applies intra-character and inter-character timing adjustments.
   *
   * @param {string} code - The Morse code sequence to play.
   * @param {number} time - The start time for the sequence in seconds.
   * @returns {number} The updated time after the code is played.
   */
  function playCode(code, time) {
    for (let i = 0; i < code.length; i++) {
      const symbol = code[i];
      if (symbol === '.' || symbol === '-') {
        time = playSymbol(symbol, time);
        // Always add intra-character space after each symbol
        time += SYMBOL_SPACE;
      }
    }
    time += LETTER_SPACE - SYMBOL_SPACE;
    return time;
  }

  /**
   * Plays a single token, either a Morse code sequence or a word space.
   *
   * Recognizes spaces as word boundaries and adjusts timing accordingly. Looks up
   * tokens in the Morse code map and plays them using `playCode`.
   *
   * @param {string} token - The token to play (character, prosign, or space).
   * @param {number} time - The start time for the token in seconds.
   * @returns {number} The updated time after the token is played.
   */
  function playToken(token, time) {
    if (token === ' ') {
      // Adjust time to include word space (subtract last LETTER_SPACE added)
      time += WORD_SPACE - LETTER_SPACE;
    } else {
      const code = morseCodeMap[token.toLowerCase()];
      if (code) {
        time = playCode(code, time);
      } else {
        console.warn(`Unrecognized token: ${token}`);
      }
    }
    return time;
  }

  /**
   * Plays a full sentence as Morse code.
   *
   * Tokenizes the sentence and plays each token sequentially. Applies word spacing
   * and adjusts timing based on Farnsworth settings if enabled.
   *
   * @param {string} sentence - The sentence to play.
   * @param {number} startTime - The starting time for playback, defaults to current time.
   * @returns {number} The final time after the sentence is played.
   */
  function playSentence(sentence, startTime = context.currentTime) {
    // Uncomment the following line to log the sentence being played (for debugging)
    // console.log(`/ Playing sentence: ${sentence}`);

    let time = startTime;
    const tokens = tokenize(sentence);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      time = playToken(token, time);
    }
    return time;
  }

  return {playSentence, context};
}

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

  if (selectedQRN === "off") {
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
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => context.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
      backgroundStaticSource = context.createBufferSource();
      backgroundStaticSource.buffer = audioBuffer;
      backgroundStaticSource.loop = true;

      staticGain = context.createGain();
      staticGain.gain.value = staticGainValues[selectedQRN] || 1.0;

      backgroundStaticSource.connect(staticGain);
      staticGain.connect(context.destination);

      backgroundStaticSource.start();

    })
    .catch(error => {
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
    console.log("Stopping background static");

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

/**
 * Stops all audio playback and resets the audio context.
 *
 * Closes the current audio context, clears the audio lock, and stops
 * any active background static noise. Reinitializes a new audio context.
 */
export function stopAllAudio() {
  audioContext.close();
  audioContext = new AudioContext();
  audioLockUntil = 0;

  stopBackgroundStatic();
}
