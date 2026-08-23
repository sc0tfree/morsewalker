export function buildStation(overrides = {}) {
  return {
    callsign: 'W6NYC',
    wpm: 20,
    enableFarnsworth: false,
    farnsworthSpeed: null,
    volume: 0.7,
    frequency: 600,
    name: 'Henry',
    state: 'CA',
    serialNumber: '01',
    cwopsNumber: 1234,
    player: null,
    qsb: false,
    qsbFrequency: 0.25,
    qsbDepth: 0.8,
    ...overrides,
  };
}
