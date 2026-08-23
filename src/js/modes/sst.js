/**
 * K1USN SST mode: a pileup where each station sends a name and a state, both of
 * which are scored, and your sign-off wishes the operator good luck by name.
 *
 * See `./index.js` for the descriptor shape shared by every mode.
 */
export default {
  id: 'sst',
  label: 'K1USN SST',
  ui: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Name',
    showInfoField2: true,
    infoField2Placeholder: 'State',
    tableExtraColumn: true,
    extraColumnHeader: 'Additional Info',
    resultsHeader: 'SST Mode Results',
  },
  logic: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ SST ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) =>
      `${yourStation.name} ${yourStation.state}`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.name} ${theirStation.name} ${theirStation.state}`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `GL ${arbitrary} TU ${yourStation.callsign} SST`,
    theirSignoff: null,
    signoffArg: ({ infoValue1 }) => infoValue1,
    requiresInfoField: true,
    requiresInfoField2: true,
    showTuStep: true,
    modeName: 'SST',
    extraInfoFieldKey: 'name',
    extraInfoFieldKey2: 'state',
  },
};
