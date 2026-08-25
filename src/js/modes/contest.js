/**
 * Basic Contest mode: a pileup where each station sends a serial number, and
 * the QSO ends on your sign-off with no reply from the calling station.
 *
 * See `./index.js` for the descriptor shape shared by every mode.
 */
export default {
  id: 'contest',
  label: 'Basic Contest',
  ui: {
    showTuButton: true,
    showAgnButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Serial Number',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: true,
    extraColumnHeader: 'Serial Number',
    resultsHeader: 'Contest Mode Results',
  },
  logic: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ TEST DE ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) => `5NN`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `5NN ${theirStation.serialNumber} TU`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.callsign}`,
    theirSignoff: null,
    signoffArg: () => null,
    exchangeComponents: [
      {
        id: 'serialNumber',
        inputId: 'infoField',
        fieldKey: 'serialNumber',
        request: 'NR?',
        reply: (station) => station.serialNumber,
      },
    ],
    requiresInfoField: true,
    requiresInfoField2: false,
    showTuStep: true,
    modeName: 'Contest',
    extraInfoFieldKey: 'serialNumber',
    extraInfoFieldKey2: null,
  },
  requiredOperatorFields: [],
};
