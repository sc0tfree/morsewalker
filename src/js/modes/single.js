/**
 * Single Caller mode: one station answers at a time and the QSO completes in
 * the send step, with no TU step and no exchanged info beyond the callsign.
 *
 * See `./index.js` for the descriptor shape shared by every mode.
 */
export default {
  id: 'single',
  label: 'Single Caller',
  ui: {
    showTuButton: false,
    showAgnButton: false,
    showInfoField: false,
    infoFieldPlaceholder: '',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: false,
    extraColumnHeader: '',
    resultsHeader: 'Single Mode Results',
  },
  logic: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ DE ${yourStation.callsign} K`,
    yourExchange: (yourStation, theirStation, arbitrary) => `5NN`,
    theirExchange: (yourStation, theirStation, arbitrary) => `R 5NN TU`,
    yourSignoff: (yourStation, theirStation, arbitrary) => `TU EE`,
    theirSignoff: (yourStation, theirStation, arbitrary) => `EE`,
    signoffArg: () => null,
    exchangeComponents: [],
    requiresInfoField: false,
    requiresInfoField2: false,
    showTuStep: false,
    modeName: 'Single',
    extraInfoFieldKey: null,
    extraInfoFieldKey2: null,
  },
  requiredOperatorFields: [],
};
