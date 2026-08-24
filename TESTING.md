# Testing Morse Walker

This suite characterizes the behavior of `v1` while the source is reorganized.
The reorganization must not change messages, timing formulas, random draw order,
state transitions, DOM behavior, persistence, telemetry, or audio scheduling.

Baseline commit: `35f975495156f3b23ab5b7ab6a18d1c0b24df6ad`

## Commands

- `npm test` — run the unit, DOM, and session integration suites once.
- `npm run test:watch` — run Vitest in watch mode.
- `npm run test:unit` — run focused feature tests.
- `npm run test:dom` — run the DOM-backed settings and results tests in jsdom.
- `npm run test:integration` — run complete session flows with test-side audio,
  time, random, storage, and network controls.
- `npm run test:coverage` — run the Vitest suites with V8 coverage.
- `npm run test:e2e` — build the production artifact and run the focused
  Chromium journeys.
- `npm run lint` — check source and test JavaScript for errors.
- `npm run format:check` — check formatting without changing files.
- `npm run verify` — run formatting, lint, coverage, and the production build.

## Core behavior matrix

### Modes

- Single Caller sends `CQ DE <CALL> K`, completes after a confirmed exact
  callsign, records the result, and automatically schedules the next caller.
- Basic Contest sends `CQ TEST DE <CALL>`, exchanges `5NN` and a serial number,
  and completes through TU.
- POTA sends `CQ POTA DE <CALL>`, exchanges signal reports and state, and
  completes through TU.
- SST sends `CQ SST <CALL>`, exchanges name and state, and completes through TU.
- CWT sends `CQ CWT <CALL>`, exchanges name and CW Ops number, and completes
  through TU.

Every mode is covered for its exact messages, required own-station fields,
mode-specific inputs, result fields, and completion path.

### Session actions

- CQ validates settings, creates the user station, and starts either one caller
  or a weighted pileup without exceeding the configured maximum.
- Send preserves the current behavior for empty input, wrong input, partial
  callsigns, exact callsigns, uncertain exact callsigns containing `?`, `AGN`,
  `AGN?`, `?`, and `QRS`.
- AGN becomes available after an exact caller is selected when at least one
  mode-specific field is blank, equals `AGN`, or contains `?`. One missing field
  sends its canonical request; all missing fields send `AGN?`. The selected
  station repeats only those fields without logging or advancing the QSO.
- TU is ignored until the current pileup exchange is ready, then records the
  selected caller, clears fields, removes that caller, optionally adds callers,
  and restarts the pileup.
- Stop, Reset, mode changes, repeated actions, actions attempted while the
  audio lock is active, and immediate active-QRN restarts are characterized.

### Settings and generated stations

- Own callsign, name, state, speed, sidetone, and volume parsing and persistence.
- Mode-specific required fields and the validation rules currently enforced.
- Station limits, speed/tone/volume/wait ranges, US-only selection, callsign
  formats, Farnsworth, cut numbers, QRN, QSB, and QSB percentage.
- Deterministic random boundaries for callsign shape, station attributes,
  weighted pileup size, response delays, QSB assignment, and post-TU arrivals.

### Matching and results

- Callsign matching covers perfect, prefix, middle/end, one-substitution,
  extended-prefix, and initial-two-character partial criteria.
- Results preserve attempts, total-time behavior, WPM/Farnsworth formatting,
  copied-field comparison, per-field AGN request counts, newest-first rows, and
  summary averages.

### Browser journey

Chromium completes one deterministic journey in each mode and focused recovery
journeys for repeats, partial calls, QRS, invalid settings, mode changes, Stop,
Reset, persistence, results, component-specific AGN fills, and keyboard-operated
app controls.

## Manual audio checklist

Use a human ear before and after the audio file split. Compare from the same
browser, output device, volume, and settings.

- Letters, digits, `.`, `,`, `?`, `/`, and the supported prosigns sound
  unchanged.
- Dot/dash rhythm and letter/word spacing sound unchanged at normal speed.
- Farnsworth spacing sounds unchanged at several character/effective speeds.
- User sidetone frequency and volume sound unchanged.
- One caller and overlapping pileups preserve relative timing and volume.
- Partial replies, repeats, uncertain exact replies, and QRS sound unchanged.
- Cut-number exchanges sound unchanged.
- Component fills transmit the displayed request and only the selected
  mode-specific values; numeric fills use the same cut-number settings as the
  complete exchange.
- QSB fade rates follow each station's generated frequency; non-QSB audio and
  each QRN level sound unchanged.
- During an active session, Normal, Moderate, Heavy, Off, and back to an audible
  QRN level follow every selection without a click, gain surge, or stuck-Off
  state. The same changes before CQ remain silent.
- With QRN active, Stop, Reset, mode changes, and an immediate restart preserve
  the one-second fade, accept the next action, and introduce no stale or
  overlapping QRN.

Subjective audio quality is intentionally a manual release gate. Automated
audio tests protect deterministic schedules and Web Audio API interactions, not
perceived sound.
