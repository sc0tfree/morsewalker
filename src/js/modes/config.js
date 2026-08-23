/**
 * modeUIConfig defines the UI-related aspects of each mode, including whether
 * one or two info fields are displayed, their placeholders, and result headers.
 * Additionally, it specifies what the extra column header should be.
 */
export const modeUIConfig = {
  single: {
    showTuButton: false,
    showInfoField: false,
    infoFieldPlaceholder: '',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: false,
    extraColumnHeader: '',
    resultsHeader: 'Single Mode Results',
  },
  contest: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Serial Number',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: true,
    extraColumnHeader: 'Serial Number',
    resultsHeader: 'Contest Mode Results',
  },
  pota: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'State',
    showInfoField2: false,
    infoField2Placeholder: '',
    tableExtraColumn: true,
    extraColumnHeader: 'State',
    resultsHeader: 'POTA Mode Results',
  },
  sst: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Name',
    showInfoField2: true,
    infoField2Placeholder: 'State',
    tableExtraColumn: true,
    extraColumnHeader: 'Additional Info',
    resultsHeader: 'SST Mode Results',
  },
  cwt: {
    showTuButton: true,
    showInfoField: true,
    infoFieldPlaceholder: 'Name',
    showInfoField2: true,
    infoField2Placeholder: 'CW Ops No.',
    tableExtraColumn: true,
    extraColumnHeader: 'Additional Info',
    resultsHeader: 'CWT Mode Results',
  },
};

/**
 * modeLogicConfig centralizes the message construction logic for various modes.
 * Each mode’s functions define how CQ calls, exchanges, and final messages are generated,
 * removing the need for conditional branching (e.g., if/else statements) elsewhere.
 * Instead of embedding placeholders, these functions use template literals and accept
 * the necessary parameters directly.
 *
 * The extraInfoFieldKey and extraInfoFieldKey2 properties specify which callingStation
 * attributes are compared against the user's input during the TU step.
 */

export const modeLogicConfig = {
  single: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ DE ${yourStation.callsign} K`,
    yourExchange: (yourStation, theirStation, arbitrary) => `5NN`,
    theirExchange: (yourStation, theirStation, arbitrary) => `R 5NN TU`,
    yourSignoff: (yourStation, theirStation, arbitrary) => `TU EE`,
    theirSignoff: (yourStation, theirStation, arbitrary) => `EE`,
    requiresInfoField: false,
    requiresInfoField2: false,
    showTuStep: false,
    modeName: 'Single',
    extraInfoFieldKey: null,
    extraInfoFieldKey2: null,
  },
  pota: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ POTA DE ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) => `UR 5NN <BK>`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `<BK> UR 5NN ${theirStation.state} ${theirStation.state} <BK>`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `<BK> TU ${arbitrary} 73 EE`,
    theirSignoff: (yourStation, theirStation, arbitrary) => `EE`,
    requiresInfoField: true,
    requiresInfoField2: false,
    showTuStep: true,
    modeName: 'POTA',
    extraInfoFieldKey: 'state',
    extraInfoFieldKey2: null,
  },
  contest: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ TEST DE ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) => `5NN`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `5NN ${theirStation.serialNumber} TU`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.callsign}`,
    theirSignoff: null,
    requiresInfoField: true,
    requiresInfoField2: false,
    showTuStep: true,
    modeName: 'Contest',
    extraInfoFieldKey: 'serialNumber',
    extraInfoFieldKey2: null,
  },
  sst: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ SST ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) =>
      `${yourStation.name} ${yourStation.state}`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.name} ${theirStation.name} ${theirStation.state}`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `GL ${arbitrary} TU ${yourStation.callsign} SST`,
    theirSignoff: null,
    requiresInfoField: true,
    requiresInfoField2: true,
    showTuStep: true,
    modeName: 'SST',
    extraInfoFieldKey: 'name',
    extraInfoFieldKey2: 'state',
  },
  cwt: {
    cqMessage: (yourStation, theirStation, arbitrary) =>
      `CQ CWT ${yourStation.callsign}`,
    yourExchange: (yourStation, theirStation, arbitrary) =>
      `${yourStation.name} CWA`,
    theirExchange: (yourStation, theirStation, arbitrary) =>
      `${theirStation.name} ${theirStation.cwopsNumber} TU`,
    yourSignoff: (yourStation, theirStation, arbitrary) =>
      `TU ${yourStation.callsign}`,
    theirSignoff: null,
    requiresInfoField: true,
    requiresInfoField2: true,
    showTuStep: true,
    modeName: 'CWT',
    extraInfoFieldKey: 'name',
    extraInfoFieldKey2: 'cwopsNumber',
  },
};
