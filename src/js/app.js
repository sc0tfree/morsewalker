// Import Bootstrap CSS
import 'bootswatch/dist/cerulean/bootstrap.min.css';

// Import custom styles
import '../css/style.css';

// Import Bootstrap JavaScript
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Import Font Awesome
import '@fortawesome/fontawesome-free/js/all.min.js';

import {
  audioContext,
  createMorsePlayer,
  getAudioLock,
  updateAudioLock,
  isBackgroundStaticPlaying,
  createBackgroundStatic,
  stopAllAudio,
} from './audio.js';
import { clearAllInvalidStates, getInputs } from './inputs.js';
import {
  compareStrings,
  respondWithAllStations,
  addStations,
  addTableRow,
  clearTable,
  updateActiveStations,
  printStation,
} from './util.js';
import { getYourStation, getCallingStation } from './stationGenerator.js';
import { updateStaticIntensity } from './audio.js';
import { modeLogicConfig, modeUIConfig } from './modes.js';

/**
 * Application state variables.
 *
 * - `currentMode`: Tracks the currently selected mode (e.g., single, multi-station).
 * - `inputs`: Stores the user-provided inputs retrieved from the form.
 * - `currentStations`: An array of stations currently active in multi-station mode.
 * - `currentStation`: The single active station in single mode.
 * - `activeStationIndex`: Tracks the index of the current active station in multi-station mode.
 * - `readyForTU`: Boolean indicating if the "TU" step is ready to proceed.
 * - `currentStationAttempts`: Counter for the number of attempts with the current station.
 * - `currentStationStartTime`: Timestamp for when the current station interaction started.
 * - `totalContacts`: Counter for the total number of completed contacts.
 * - `yourStation`: Stores the user's station configuration.
 * - `lastRespondingStations`: An array of stations that last responded to the user's call.
 * - `farnsworthLowerBy`: The amount to increase the Farnsworth spacing when using QRS.
 */
let currentMode;
let inputs = null;
let currentStations = [];
let currentStation = null;
let activeStationIndex = null;
let readyForTU = false; // This means that the last send was a perfect match
let currentStationAttempts = 0;
let currentStationStartTime = null;
let totalContacts = 0;
let yourStation = null;
let lastRespondingStations = null;
const farnsworthLowerBy = 6;

/**
 * Event listener setup.
 *
 * - Adds click and change event listeners to UI elements like buttons and checkboxes.
 * - Configures interactions for elements such as the CQ button, mode selection radios, and input fields.
 * - Includes special handling for QSB and Farnsworth UI components to dynamically enable/disable related inputs.
 */
document.addEventListener('DOMContentLoaded', () => {
  // UI elements
  const cqButton = document.getElementById('cqButton');
  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  const sendButton = document.getElementById('sendButton');
  const tuButton = document.getElementById('tuButton');
  const resetButton = document.getElementById('resetButton');
  const stopButton = document.getElementById('stopButton');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const yourCallsign = document.getElementById('yourCallsign');
  const yourName = document.getElementById('yourName');
  const yourSpeed = document.getElementById('yourSpeed');
  const yourSidetone = document.getElementById('yourSidetone');
  const yourVolume = document.getElementById('yourVolume');

  // Event Listeners
  cqButton.addEventListener('click', cq);
  sendButton.addEventListener('click', send);
  tuButton.addEventListener('click', tu);
  resetButton.addEventListener('click', reset);
  stopButton.addEventListener('click', stop);
  modeRadios.forEach((radio) => {
    radio.addEventListener('change', changeMode);
  });

  // QSB
  const qsbCheckbox = document.getElementById('qsb');
  const qsbPercentage = document.getElementById('qsbPercentage');
  // Initially set the slider state based on the checkbox
  qsbPercentage.disabled = !qsbCheckbox.checked;
  // Add event listener to update the slider state when checkbox changes
  qsbCheckbox.addEventListener('change', () => {
    qsbPercentage.disabled = !qsbCheckbox.checked;
  });

  // Farnsworth elements
  const enableFarnsworthCheckbox = document.getElementById('enableFarnsworth');
  const farnsworthSpeedInput = document.getElementById('farnsworthSpeed');
  // Set initial state based on whether Farnsworth is enabled
  farnsworthSpeedInput.disabled = !enableFarnsworthCheckbox.checked;
  // Toggle the Farnsworth speed input when the checkbox changes
  enableFarnsworthCheckbox.addEventListener('change', () => {
    farnsworthSpeedInput.disabled = !enableFarnsworthCheckbox.checked;
  });

  // Cut Number elements
  const enableCutNumbersCheckbox = document.getElementById('enableCutNumbers');
  const cutNumberIds = [
    'cutT',
    'cutA',
    'cutU',
    'cutV',
    'cutE',
    'cutG',
    'cutD',
    'cutN',
  ];

  // Set initial state based on whether Cut Numbers is enabled
  cutNumberIds.forEach((id) => {
    const checkbox = document.getElementById(id);
    checkbox.disabled = !enableCutNumbersCheckbox.checked;
  });

  // Toggle the cut-number checkboxes when "Enable Cut Numbers" changes
  enableCutNumbersCheckbox.addEventListener('change', () => {
    cutNumberIds.forEach((id) => {
      const checkbox = document.getElementById(id);
      checkbox.disabled = !enableCutNumbersCheckbox.checked;
    });
  });

  function updateResponsiveButtons() {
    const responsiveButtons = document.querySelectorAll('.btn-responsive');
    responsiveButtons.forEach((button) => {
      if (window.innerWidth < 576) {
        button.classList.add('btn-sm');
      } else {
        button.classList.remove('btn-sm');
      }
    });
  }

  // Run on initial load
  updateResponsiveButtons();
  // Run on every window resize
  window.addEventListener('resize', updateResponsiveButtons);

  // Add hotkey for CQ (Ctrl + Shift + C)
  // Add an event listener for keydown events
  document.addEventListener('keydown', (event) => {
    // Check if Ctrl and Shift are pressed and the key is 'C'
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
      // Prevent default behavior to avoid browser conflicts
      event.preventDefault();

      // Call the CQ function
      cq();
    }
  });

  responseField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendButton.click();
    }
  });

  infoField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && tuButton.style.display !== 'none') {
      event.preventDefault();
      tuButton.click();
    }
  });

  infoField2.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && tuButton.style.display !== 'none') {
      event.preventDefault();
      tuButton.click();
    }
  });

  cqButton.addEventListener('click', () => {
    responseField.focus();
  });

  // Local Storage keys for user settings
  const keys = {
    yourCallsign: 'yourCallsign',
    yourName: 'yourName',
    yourState: 'yourState', // Added yourState
    yourSpeed: 'yourSpeed',
    yourSidetone: 'yourSidetone',
    yourVolume: 'yourVolume',
  };

  /**
   * Local storage handling for user settings.
   *
   * - Loads saved values from local storage into input fields during initialization.
   * - Saves updated input field values to local storage whenever they change.
   * - Ensures persistence of user preferences across sessions.
   */
  yourCallsign.value =
    localStorage.getItem(keys.yourCallsign) || yourCallsign.value;
  yourName.value = localStorage.getItem(keys.yourName) || yourName.value;
  yourState.value = localStorage.getItem(keys.yourState) || yourState.value; // Load yourState
  yourSpeed.value = localStorage.getItem(keys.yourSpeed) || yourSpeed.value;
  yourSidetone.value =
    localStorage.getItem(keys.yourSidetone) || yourSidetone.value;
  yourVolume.value = localStorage.getItem(keys.yourVolume) || yourVolume.value;

  // Save user settings to localStorage on input change
  yourCallsign.addEventListener('input', () => {
    localStorage.setItem(keys.yourCallsign, yourCallsign.value);
  });
  yourName.addEventListener('input', () => {
    localStorage.setItem(keys.yourName, yourName.value);
  });
  yourState.addEventListener('input', () => {
    // Save yourState
    localStorage.setItem(keys.yourState, yourState.value);
  });
  yourSpeed.addEventListener('input', () => {
    localStorage.setItem(keys.yourSpeed, yourSpeed.value);
  });
  yourSidetone.addEventListener('input', () => {
    localStorage.setItem(keys.yourSidetone, yourSidetone.value);
  });
  yourVolume.addEventListener('input', () => {
    localStorage.setItem(keys.yourVolume, yourVolume.value);
  });

  // Handle QRN intensity changes
  const qrnRadioButtons = document.querySelectorAll('input[name="qrn"]');
  qrnRadioButtons.forEach((radio) => {
    radio.addEventListener('change', updateStaticIntensity);
  });

  // Determine mode from local storage or default to single
  const savedMode = localStorage.getItem('mode') || 'single';
  // Check the corresponding radio button based on savedMode
  const savedModeRadio = document.querySelector(
    `input[name="mode"][value="${savedMode}"]`
  );
  if (savedModeRadio) {
    savedModeRadio.checked = true;
  }

  // Set currentMode to the saved or default mode
  currentMode = savedMode;

  // Update basic stats on page load
  if (yourCallsign.value !== '') {
    fetch(`https://stats.${window.location.hostname}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: currentMode, callsign: yourCallsign.value }),
    }).catch((error) => {
      console.error('Failed to send CloudFlare stats.');
    });
  }

  // Reset state to ensure no leftover stations when loading
  resetGameState();

  // Apply mode settings now that currentMode matches the dropdown and local storage
  applyModeSettings(currentMode);
});

/**
 * Retrieves the logic configuration for the current mode.
 *
 * Returns the object containing mode-specific logic and rules, such as
 * message templates and exchange formats, based on the selected mode.
 *
 * @returns {Object} The configuration object for the current mode.
 */
function getModeConfig() {
  return modeLogicConfig[currentMode];
}

/**
 * Updates the UI to reflect the current mode's configuration.
 *
 * Adjusts visibility, placeholders, and content of various UI elements like the
 * "TU" button, input fields, and results table. Also modifies extra columns in the
 * results table based on mode-specific requirements.
 *
 * @param {string} mode - The mode to apply settings for.
 */
function applyModeSettings(mode) {
  const config = modeUIConfig[mode];
  const tuButton = document.getElementById('tuButton');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  const resultsTable = document.getElementById('resultsTable');
  const modeResultsHeader = document.getElementById('modeResultsHeader');

  // TU button visibility
  tuButton.style.display = config.showTuButton ? 'inline-block' : 'none';

  // Info field visibility & placeholder
  if (config.showInfoField) {
    infoField.style.display = 'inline-block';
    infoField.placeholder = config.infoFieldPlaceholder;
  } else {
    infoField.style.display = 'none';
    infoField.value = '';
  }

  // Info field 2 visibility & placeholder
  if (config.showInfoField2) {
    infoField2.style.display = 'inline-block';
    infoField2.placeholder = config.infoField2Placeholder;
  } else {
    infoField2.style.display = 'none';
    infoField2.value = '';
  }

  // Update results header text
  modeResultsHeader.textContent = config.resultsHeader;

  // Show/hide the extra column in the results table
  const extraColumns = resultsTable.querySelectorAll('.mode-specific-column');
  extraColumns.forEach((col) => {
    col.style.display = config.tableExtraColumn ? 'table-cell' : 'none';
  });

  // Update extra column header text
  const extraColumnHeaders = resultsTable.querySelectorAll(
    'thead .mode-specific-column'
  );
  extraColumnHeaders.forEach((header) => {
    header.textContent = config.extraColumnHeader || 'Additional Info';
  });
}

/**
 * Resets the game state and clears all UI elements.
 *
 * Resets variables related to stations, attempts, and contacts. Clears the results
 * table, disables the CQ button, stops all audio, and reinitializes the response field.
 */
function resetGameState() {
  currentStations = [];
  currentStation = null;
  activeStationIndex = null;
  readyForTU = false;
  currentStationAttempts = 0;
  currentStationStartTime = null;
  totalContacts = 0;

  updateActiveStations(0);
  clearTable('resultsTable');
  document.getElementById('responseField').value = '';
  document.getElementById('infoField').value = '';
  document.getElementById('infoField2').value = '';
  document.getElementById('cqButton').disabled = false;
  stopAllAudio();
  updateAudioLock(0);
}

/**
 * Handles changes to the operating mode.
 *
 * Updates the `currentMode` variable, saves the new mode to local storage,
 * resets the game state, clears invalid states, and applies the new mode's settings.
 */
function changeMode() {
  const selectedMode = document.querySelector(
    'input[name="mode"]:checked'
  ).value;
  currentMode = selectedMode;
  localStorage.setItem('mode', currentMode);
  resetGameState();
  clearAllInvalidStates();
  applyModeSettings(currentMode);
}

/**
 * Handles the "CQ" button click to call stations.
 *
 * - In multi-station modes, calling CQ adds more stations if enabled.
 * - In single mode, calling CQ fetches a new station if none is active.
 * - Plays the CQ message using the user's station configuration.
 */
function cq() {
  if (getAudioLock()) return;

  const modeConfig = getModeConfig();
  const cqButton = document.getElementById('cqButton');

  if (!modeConfig.showTuStep && currentStation !== null) {
    return;
  }

  let backgroundStaticDelay = 0;
  if (!isBackgroundStaticPlaying()) {
    createBackgroundStatic();
    backgroundStaticDelay = 2;
  }

  inputs = getInputs();
  if (inputs === null) return;

  yourStation = getYourStation();
  yourStation.player = createMorsePlayer(yourStation);

  let cqMsg = modeConfig.cqMessage(yourStation, null, null);
  let yourResponseTimer = yourStation.player.playSentence(
    cqMsg,
    audioContext.currentTime + backgroundStaticDelay
  );
  updateAudioLock(yourResponseTimer);

  if (modeConfig.showTuStep) {
    // Contest-like modes: CQ adds more stations
    addStations(currentStations, inputs);
    respondWithAllStations(currentStations, yourResponseTimer);
    lastRespondingStations = currentStations;
  } else {
    // Single mode: Just get one station
    cqButton.disabled = true;
    nextSingleStation(yourResponseTimer);
  }
}

/**
 * Sends the user's response to a station or stations.
 *
 * Matches the user's input against active stations, handles repeat requests, and
 * processes partial or perfect matches. Plays responses and exchanges based on the
 * mode's configuration. Adjusts the game state for each scenario.
 */
function send() {
  if (getAudioLock()) return;
  const modeConfig = getModeConfig();
  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');

  let responseFieldText = responseField.value.trim().toUpperCase();

  // Prevent sending if responseField text box is empty
  if (responseFieldText === '') {
    // If the response field is empty and there are no active stations, call CQ
    if (currentStations.length === 0) {
      cq();
    }
    return;
  }

  console.log(`--> Sending "${responseFieldText}"`);

  if (modeConfig.showTuStep) {
    // Multi-station scenario
    if (currentStations.length === 0) return;

    let yourResponseTimer = yourStation.player.playSentence(responseFieldText);
    updateAudioLock(yourResponseTimer);

    // Handling repeats
    if (
      responseFieldText === '?' ||
      responseFieldText === 'AGN' ||
      responseFieldText === 'AGN?'
    ) {
      respondWithAllStations(currentStations, yourResponseTimer);
      lastRespondingStations = currentStations;
      currentStationAttempts++;
      return;
    }

    // Handle QRS
    if (responseFieldText === 'QRS') {
      // For each lastRespondingStations,
      // if Farensworth is already enabled, lower it by farnsworthLowerBy, but not less than 5
      lastRespondingStations.forEach((stn) => {
        if (stn.enableFarnsworth) {
          stn.farnsworthSpeed = Math.max(
            5,
            stn.farnsworthSpeed - farnsworthLowerBy
          );
        } else {
          stn.enableFarnsworth = true;
          stn.farnsworthSpeed = stn.wpm - farnsworthLowerBy;
        }
      });

      respondWithAllStations(lastRespondingStations, yourResponseTimer);
      currentStationAttempts++;
      return;
    }

    let results = currentStations.map((stn) =>
      compareStrings(stn.callsign, responseFieldText.replace('?', ''))
    );
    let hasQuestionMark = responseFieldText.includes('?');

    if (results.includes('perfect')) {
      let matchIndex = results.indexOf('perfect');
      if (hasQuestionMark) {
        // Perfect match but user unsure
        let theirResponseTimer = currentStations[
          matchIndex
        ].player.playSentence('RR', yourResponseTimer + 0.25);
        updateAudioLock(theirResponseTimer);
        currentStationAttempts++;
        return;
      } else {
        // Perfect confirmed match
        let yourExchange, theirExchange;
        yourExchange =
          ' ' +
          modeConfig.yourExchange(
            yourStation,
            currentStations[matchIndex],
            null
          );
        theirExchange = modeConfig.theirExchange(
          yourStation,
          currentStations[matchIndex],
          null
        );

        if (inputs.enableCutNumbers) {
          // inputs.cutNumbers is the object returned by getSelectedCutNumbers()
          // e.g. { '0': 'T', '9': 'N' } if T/0 and N/9 are selected
          const cutMap = inputs.cutNumbers;

          // Convert any digits in yourExchange and theirExchange
          // to their cut-letter equivalent, if found in cutMap
          yourExchange = yourExchange.replace(
            /\d/g,
            (digit) => cutMap[digit] || digit
          );
          theirExchange = theirExchange.replace(
            /\d/g,
            (digit) => cutMap[digit] || digit
          );
        }

        let yourResponseTimer2 = yourStation.player.playSentence(
          yourExchange,
          yourResponseTimer
        );
        updateAudioLock(yourResponseTimer2);
        let theirResponseTimer = currentStations[
          matchIndex
        ].player.playSentence(theirExchange, yourResponseTimer2 + 0.5);
        updateAudioLock(theirResponseTimer);
        currentStationAttempts++;

        if (modeConfig.requiresInfoField) {
          infoField.focus();
        }
        readyForTU = true;
        activeStationIndex = matchIndex;
        return;
      }
    }

    if (results.includes('partial')) {
      // Partial matches: repeat them
      let partialMatchStations = currentStations.filter(
        (_, index) => results[index] === 'partial'
      );
      respondWithAllStations(partialMatchStations, yourResponseTimer);
      lastRespondingStations = partialMatchStations;
      currentStationAttempts++;
      return;
    }

    // No matches at all
    currentStationAttempts++;
  } else {
    // Single mode
    if (currentStation === null) return;

    let yourResponseTimer = yourStation.player.playSentence(responseFieldText);
    updateAudioLock(yourResponseTimer);

    if (
      responseFieldText === '?' ||
      responseFieldText === 'AGN' ||
      responseFieldText === 'AGN?'
    ) {
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      currentStationAttempts++;
      return;
    }

    if (responseFieldText === 'QRS') {
      // If Farensworth is already enabled, lower it by farnsworthLowerBy, but not less than 5
      if (currentStation.enableFarnsworth) {
        currentStation.farnsworthSpeed = Math.max(
          5,
          currentStation.farnsworthSpeed - farnsworthLowerBy
        );
      } else {
        currentStation.enableFarnsworth = true;
        currentStation.farnsworthSpeed = currentStation.wpm - farnsworthLowerBy;
      }
      // Create a new player
      currentStation.player = createMorsePlayer(currentStation);
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      currentStationAttempts++;
      return;
    }

    let compareResult = compareStrings(
      currentStation.callsign,
      responseFieldText.replace('?', '')
    );

    if (compareResult === 'perfect') {
      currentStationAttempts++;

      if (responseFieldText.includes('?')) {
        let theirResponseTimer = currentStation.player.playSentence(
          'RR',
          yourResponseTimer + 1
        );
        updateAudioLock(theirResponseTimer);
        return;
      }

      // Perfect match confirmed in single mode
      let yourExchange =
        ' ' + modeConfig.yourExchange(yourStation, currentStation, null);
      let theirExchange = modeConfig.theirExchange(
        yourStation,
        currentStation,
        null
      );

      let yourResponseTimer2 = yourStation.player.playSentence(
        yourExchange,
        yourResponseTimer
      );
      updateAudioLock(yourResponseTimer2);
      let theirResponseTimer = currentStation.player.playSentence(
        theirExchange,
        yourResponseTimer2 + 0.5
      );
      updateAudioLock(theirResponseTimer);
      let yourSignoff = modeConfig.yourSignoff(
        yourStation,
        currentStation,
        null
      );
      let yourResponseTimer3 = yourStation.player.playSentence(
        yourSignoff,
        theirResponseTimer + 0.5
      );
      updateAudioLock(yourResponseTimer3);
      let theirSignoff = modeConfig.theirSignoff(
        yourStation,
        currentStation,
        null
      );
      let theirResponseTimer2 = currentStation.player.playSentence(
        theirSignoff,
        yourResponseTimer3 + 0.5
      );
      updateAudioLock(theirResponseTimer2);

      totalContacts++;
      const wpmString =
        `${currentStation.wpm}` +
        (currentStation.enableFarnsworth
          ? ` / ${currentStation.farnsworthSpeed}`
          : '');
      addTableRow(
        'resultsTable',
        totalContacts,
        currentStation.callsign,
        wpmString,
        currentStationAttempts,
        audioContext.currentTime - currentStationStartTime,
        '' // No additional info in single mode
      );

      nextSingleStation(theirResponseTimer2);
      return;
    } else if (compareResult === 'partial') {
      currentStationAttempts++;
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      return;
    }

    // No match in single mode
    currentStationAttempts++;
    let theirResponseTimer = currentStation.player.playSentence(
      currentStation.callsign,
      yourResponseTimer + Math.random() + 0.25
    );
    updateAudioLock(theirResponseTimer);
  }
}

/**
 * Finalizes a QSO (contact) in multi-station modes.
 *
 * Compares the user's input in extra info fields against the current station's
 * attributes. Logs results, updates the UI, and optionally fetches new stations.
 * Plays the user's and station's sign-off messages.
 */
function tu() {
  if (getAudioLock()) return;
  const modeConfig = getModeConfig();
  if (!modeConfig.showTuStep || !readyForTU) return;

  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  let infoValue1 = infoField.value.trim();
  let infoValue2 = infoField2.value.trim();

  let currentStation = currentStations[activeStationIndex];
  totalContacts++;

  // Compare both fields if required
  let extraInfo = '';
  extraInfo += compareExtraInfo(
    modeConfig.extraInfoFieldKey,
    infoValue1,
    currentStation
  );
  if (modeConfig.requiresInfoField2 && modeConfig.extraInfoFieldKey2) {
    if (extraInfo.length > 0) extraInfo += ' / ';
    extraInfo += compareExtraInfo(
      modeConfig.extraInfoFieldKey2,
      infoValue2,
      currentStation
    );
  }

  let arbitrary = null;
  if (currentMode === 'sst') {
    arbitrary = infoValue1; // name
  } else if (currentMode === 'pota') {
    arbitrary = infoValue2; // state (now second field)
  }

  let yourSignoffMessage = modeConfig.yourSignoff(
    yourStation,
    currentStation,
    arbitrary
  );

  let yourResponseTimer = yourStation.player.playSentence(
    yourSignoffMessage,
    audioContext.currentTime + 0.5
  );
  updateAudioLock(yourResponseTimer);

  let responseTimerToUse = yourResponseTimer; // fallback timer

  if (typeof modeConfig.theirSignoff === 'function') {
    // Call theirSignoff only if it returns a non-empty string
    let theirSignoffMessage = modeConfig.theirSignoff(
      yourStation,
      currentStation,
      null
    );
    let theirResponseTimer = currentStation.player.playSentence(
      theirSignoffMessage,
      yourResponseTimer + 0.5
    );
    updateAudioLock(theirResponseTimer);
    responseTimerToUse = theirResponseTimer;
  } else {
    // No theirSignoff defined or it's null.
    // The QSO ends here after yourSignoff.
  }

  const wpmString =
    `${currentStation.wpm}` +
    (currentStation.enableFarnsworth
      ? ` / ${currentStation.farnsworthSpeed}`
      : '');

  // Add the QSO result to the table
  addTableRow(
    'resultsTable',
    totalContacts,
    currentStation.callsign,
    wpmString,
    currentStationAttempts,
    audioContext.currentTime - currentStationStartTime,
    extraInfo
  );

  // Remove the worked station
  currentStations.splice(activeStationIndex, 1);
  activeStationIndex = null;
  currentStationAttempts = 0;
  readyForTU = false;
  updateActiveStations(currentStations.length);

  const responseField = document.getElementById('responseField');
  responseField.value = '';
  infoField.value = '';
  infoField2.value = '';
  responseField.focus();

  // Chance of a new station joining
  if (Math.random() < 0.4) {
    addStations(currentStations, inputs);
  }

  respondWithAllStations(currentStations, responseTimerToUse);
  lastRespondingStations = currentStations;
  currentStationStartTime = audioContext.currentTime;
}

/**
 * Compares the user's input against a station's corresponding property.
 *
 * Matches the input to attributes like name, state, or serial number, and
 * returns a string indicating correctness. For incorrect matches, shows
 * the expected value.
 *
 * @param {string} fieldKey - The station attribute to compare (e.g., name, state).
 * @param {string} userInput - The user's input value.
 * @param {Object} callingStation - The station object to compare against.
 * @returns {string} A string indicating correctness or showing the expected value.
 */
function compareExtraInfo(fieldKey, userInput, callingStation) {
  if (!fieldKey) return '';

  // Grab the raw expected value
  let expectedValue = callingStation[fieldKey];

  // Handle numeric fields separately:
  if (fieldKey === 'serialNumber' || fieldKey === 'cwopsNumber') {
    let userValInt = parseInt(userInput, 10);

    // Handle NaN (i.e., empty or non-numeric input)
    if (isNaN(userValInt)) {
      return `<span class="text-warning">
                <i class="fa-solid fa-triangle-exclamation me-1"></i>
              </span> (${expectedValue})`;
    }

    let correct = userValInt === Number(expectedValue);
    return correct
      ? `<span class="text-success">
           <i class="fa-solid fa-check me-1"></i><strong>${userValInt}</strong>
         </span>`
      : `<span class="text-warning">
           <i class="fa-solid fa-triangle-exclamation me-1"></i>${userValInt}
         </span> (${expectedValue})`;
  }

  // For string-based fields (e.g. name, state), force them to string
  let upperExpectedValue = String(expectedValue).toUpperCase();
  userInput = (userInput || '').toUpperCase().trim();

  // Special rule: if both are empty => "N/A"
  if (upperExpectedValue === '') {
    return 'N/A';
  }

  // Normal string comparison
  let correct = userInput === upperExpectedValue;
  return correct
    ? `<span class="text-success">
         <i class="fa-solid fa-check me-1"></i><strong>${userInput}</strong>
       </span>`
    : `<span class="text-warning">
         <i class="fa-solid fa-triangle-exclamation me-1"></i>${userInput}
       </span> (${upperExpectedValue})`;
}

/**
 * Fetches and sets up a new station in single mode after a completed QSO.
 *
 * Creates a new station object, initializes it with a Morse player, and plays
 * the station's callsign. Updates the game state and refocuses on the response field.
 *
 * @param {number} responseStartTime - The time at which the next station interaction begins.
 */
function nextSingleStation(responseStartTime) {
  const modeConfig = getModeConfig();
  const responseField = document.getElementById('responseField');
  const cqButton = document.getElementById('cqButton');

  let callingStation = getCallingStation();
  printStation(callingStation);
  currentStation = callingStation;
  currentStationAttempts = 0;
  updateActiveStations(1);

  callingStation.player = createMorsePlayer(callingStation);
  let theirResponseTimer = callingStation.player.playSentence(
    callingStation.callsign,
    responseStartTime + Math.random() + 1
  );
  updateAudioLock(theirResponseTimer);

  currentStationStartTime = theirResponseTimer;
  responseField.value = '';
  responseField.focus();

  cqButton.disabled = !modeConfig.showTuStep && currentStation !== null;
}

/**
 * Stops all audio playback and resets the CQ button.
 *
 * Clears the game state for single mode, ensuring no active station remains.
 * Leaves multi-station mode state untouched.
 */
function stop() {
  stopAllAudio();
  const cqButton = document.getElementById('cqButton');
  cqButton.disabled = false;

  // If the mode is single, reset the current station as well
  if (currentMode === 'single') {
    currentStation = null;
    currentStationAttempts = 0;
    currentStationStartTime = null;
    updateActiveStations(0);
  }
}

/**
 * Performs a full reset of the application.
 *
 * Clears the results table, resets all variables, stops audio playback,
 * and focuses on the response field. Adjusts the CQ button based on mode logic.
 */
function reset() {
  clearTable('resultsTable');

  totalContacts = 0;
  currentStation = null;
  currentStationAttempts = 0;
  currentStationStartTime = null;
  currentStations = [];
  activeStationIndex = null;
  readyForTU = false;

  updateActiveStations(0);
  updateAudioLock(0);
  stopAllAudio();

  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  responseField.value = '';
  infoField.value = '';
  infoField2.value = '';
  responseField.focus();

  const modeConfig = getModeConfig();
  const cqButton = document.getElementById('cqButton');
  cqButton.disabled = false;
}
