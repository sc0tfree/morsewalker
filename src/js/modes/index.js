import single from './single.js';
import contest from './contest.js';
import pota from './pota.js';
import cwt from './cwt.js';
import sst from './sst.js';

/**
 * The mode registry.
 *
 * Every operating mode is defined by exactly one module in this directory,
 * which default-exports a descriptor with these properties:
 *
 * - `id`: the value used in local storage and in the mode radio buttons.
 * - `label`: the text shown on the mode's radio button.
 * - `ui`: which controls (including AGN and TU) and info fields are visible,
 *   their placeholders, and the results table headers. Consumed by `./view.js`.
 * - `logic`: the messages each side sends, which of the operator's info-field
 *   values the sign-off message quotes back (`signoffArg`), whether the info
 *   fields are required, whether the QSO has a TU step, which calling-station
 *   attributes the info fields are scored against, and the ordered
 *   `exchangeComponents` available for AGN fills. Each exchange component
 *   declares an `id`, `inputId`, station `fieldKey`, canonical `request`, and
 *   `reply` formatter. Consumed by `../session/index.js`.
 * - `requiredOperatorFields`: the operator's own settings the mode cannot run
 *   without, each an `{ id, message }` pair where `id` is both the input's DOM
 *   element id and its key on the collected inputs. Consumed by
 *   `../settings/validation.js`.
 *
 * The array order is the order the modes appear in the UI.
 *
 * To add a mode, create its module, add it here, and add its radio button in
 * `src/index.html`. Nothing else needs to change.
 */
export const modes = [single, contest, pota, cwt, sst];

const modesById = Object.fromEntries(modes.map((mode) => [mode.id, mode]));

/**
 * The ids of every registered mode, in UI order.
 */
export const modeIds = modes.map((mode) => mode.id);

/**
 * Looks up a mode descriptor by its id.
 *
 * @param {string} id - The mode id, e.g. `sst`.
 * @returns {Object|undefined} The descriptor, or undefined if unregistered.
 */
export function getMode(id) {
  return modesById[id];
}

/**
 * The UI configuration of every mode, keyed by mode id.
 */
export const modeUIConfig = Object.fromEntries(
  modes.map((mode) => [mode.id, mode.ui])
);

/**
 * The QSO logic configuration of every mode, keyed by mode id.
 */
export const modeLogicConfig = Object.fromEntries(
  modes.map((mode) => [mode.id, mode.logic])
);
