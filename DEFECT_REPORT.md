# Morse Walker Defect Report

Base behavior: `v1` at `35f975495156f3b23ab5b7ab6a18d1c0b24df6ad`

This report consolidates defects and documentation mismatches confirmed while
writing characterization tests. None were fixed on
`v1-reorganization-and-testing`.

## 1. FIXED: QSB frequency does not affect fading

Status: Fixed on `v1-defect-1-qsb-frequency`

Severity: Medium

The baseline player omitted `qsbFrequency` from its documented sine calculation,
so every station faded at an effective 1 Hz. The fix applies each station's
frequency to the calculation and generates frequencies uniformly in the
`0.85–1.15` Hz range.

Evidence:

- `src/js/audio/player.js`, `qsbAmplitude`
- `tests/unit/audio/morse-player.test.js`

## 2. Maximum wait acts as an additional spread

Severity: Medium

The controls are labeled Min Wait and Max Wait, but response delay is calculated
as `min + random * max`. The upper bound is therefore `min + max`, rather than
the configured maximum. Equal minimum and maximum values do not produce a fixed
delay.

Evidence:

- `src/js/audio/stationMix.js`, `respondWithAllStations`
- `tests/unit/audio/station-mix.test.js`

## 3. Numeric input constraints are not fully enforced

Severity: High

The HTML declares numeric minima, maxima, and steps, but the application does
not submit a form or otherwise apply all native constraints. Values such as
zero WPM, out-of-range volume, reversed tone ranges, and reversed wait ranges
can pass the current custom validation. Custom validation currently compares
only speed and volume ranges.

Evidence:

- `src/js/settings/read.js`
- `src/js/settings/validation.js`
- `tests/unit/settings/inputs.test.js`

## 4. Maximum tone is exclusive

Severity: Low

Caller tone generation uses `Math.random() * (maxTone - minTone) + minTone`
before flooring. A configured 400–900 Hz range therefore produces at most
899 Hz, despite the control being labeled Maximum Tone.

Evidence:

- `src/js/stations/generator.js`, `getCallingStation`
- `tests/unit/stations/stationGenerator.test.js`

## 5. Documented callsign-matching examples disagree with behavior

Severity: Low

Several examples documented as misses are accepted by another matching
criterion. Current behavior returns `partial` for `ABC`/`ABX`,
`ABCDE`/`AB`, and `ABCDE`/`ABCDEFX`.

Evidence:

- `src/js/stations/matching.js`
- `tests/unit/stations/util.test.js`

## 6. Result-summary documentation disagrees with behavior

Severity: Low

The summary documentation says the first result row is excluded, while the
implementation averages every result row. Characterization tests preserve the
implemented all-row average.

Evidence:

- `src/js/results/table.js`, `updateSummaryRow`
- `tests/unit/results/util-results.test.js`

## 7. Resetting active QRN re-locks the replacement audio context

Severity: Medium

When QRN is active, `stopAllAudio` replaces the foreground context and clears
its lock, then the QRN fade extends the new lock for the fade duration. An
immediate action can therefore remain blocked after an audio reset.

Evidence:

- `src/js/audio/lifecycle.js`
- `src/js/audio/background-static.js`, `stopBackgroundStatic`
- `tests/unit/audio/background-static.test.js`

## 8. State persistence relies on a browser-created global

Severity: Medium

The persistence code references `yourState` without declaring or querying it,
relying on the browser exposing the element ID as a global variable. The
current Chromium behavior supports this, but it is environment-dependent.

Evidence:

- `src/js/settings/storage.js`
- `tests/integration/session/session.test.js`

## 9. An unrecognized stored mode prevents startup

Severity: Medium

The saved mode is read from local storage and used without checking that it is
a mode the application knows about. An unrecognized value matches no radio
button, so no mode is selected, and it then reaches `applyModeSettings`, which
looks the value up and reads properties off the result. The lookup misses, the
property read throws, and the rest of the `DOMContentLoaded` handler never
runs, leaving the page unconfigured until local storage is cleared.

Any operator who used a build with a mode that was later renamed or removed
would hit this on their next visit.

Evidence:

- `src/js/session/index.js`, mode initialization on `DOMContentLoaded`
- `src/js/modes/view.js`, `applyModeSettings`
