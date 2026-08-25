/**
 * CWT mode: a pileup where each station sends a name and a CW Ops number, both
 * of which are scored.
 *
 * See `./index.js` for the descriptor shape shared by every mode.
 */
export default {
  id: 'cwt',
  label: 'CWT',
  ui: {
    showTuButton: true,
    showAgnButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Name',
    showInfoField2: true,
    infoField2Placeholder: 'CW Ops No.',
    tableExtraColumn: true,
    extraColumnHeader: 'Additional Info',
    resultsHeader: 'CWT Mode Results',
  },
  logic: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ CWT ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) =>
      `${yourStation.name} CWA`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `${theirStation.name} ${theirStation.cwopsNumber} TU`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.callsign}`,
    theirSignoff: null,
    signoffArg: () => null,
    exchangeComponents: [
      {
        id: 'name',
        inputId: 'infoField',
        fieldKey: 'name',
        request: 'NAME?',
        reply: (station) => station.name,
      },
      {
        id: 'cwopsNumber',
        inputId: 'infoField2',
        fieldKey: 'cwopsNumber',
        request: 'NR?',
        reply: (station) => `${station.cwopsNumber}`,
      },
    ],
    requiresInfoField: true,
    requiresInfoField2: true,
    showTuStep: true,
    modeName: 'CWT',
    extraInfoFieldKey: 'name',
    extraInfoFieldKey2: 'cwopsNumber',
  },
  requiredOperatorFields: [
    { id: 'yourName', message: 'Your name is required for CWT mode.' },
  ],
};
