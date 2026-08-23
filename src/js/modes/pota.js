/**
 * POTA Activator mode: a pileup where each station sends its state, and your
 * sign-off names the station you just worked.
 *
 * See `./index.js` for the descriptor shape shared by every mode.
 */
export default {
  id: 'pota',
  label: 'POTA Activator',
  ui: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'State',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: true,
    extraColumnHeader: 'State',
    resultsHeader: 'POTA Mode Results',
  },
  logic: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ POTA DE ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) => `UR 5NN <BK>`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `<BK> UR 5NN ${theirStation.state} ${theirStation.state} <BK>`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `<BK> TU ${arbitrary} 73 EE`,
    theirSignoff: (yourStation, theirStation, arbitrary) => `EE`,
    signoffArg: ({ infoValue1 }) => infoValue1,
    requiresInfoField: true,
    requiresInfoField2: false,
    showTuStep: true,
    modeName: 'POTA',
    extraInfoFieldKey: 'state',
    extraInfoFieldKey2: null,
  },
  requiredOperatorFields: [],
};
