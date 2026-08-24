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

## 2. FIXED: Maximum wait acts as an additional spread

Status: Fixed on `v1-defect-2-max-wait`

Severity: Medium

The baseline calculated response delay as `min + random * max`, making Max Wait
an additional spread rather than the upper endpoint. The fix samples between
the configured bounds, so equal values produce a fixed delay. The default Max
Wait increases from 1.75 to 2 seconds, preserving the existing `[0.25, 2)`
second response timing.

Evidence:

- `src/js/audio/stationMix.js`, `respondWithAllStations`
- `src/index.html`, Min Wait and Max Wait defaults
- `tests/unit/audio/station-mix.test.js`
- `tests/unit/settings/inputs.test.js`

## 3. FIXED: Numeric input constraints are not fully enforced

Status: Fixed on `v1-defect-3-input-ranges`

Severity: High

The HTML declared numeric minima, maxima, and steps, but the application does
not submit a form or otherwise apply all native constraints. Values such as
zero WPM, out-of-range volume, reversed tone ranges, and reversed wait ranges
passed the previous custom validation, which compared only speed and volume
ranges. The fix checks every numeric field against the `min` and `max` it
declares, and orders all four min/max pairs. Bounds are read from the element
rather than the collected inputs, because collection rescales volumes, and
disabled fields are exempt.

The declared ranges were also tightened to logical values: speed and
Farnsworth speed to `5–60` WPM, tone and sidetone to `200–1500` Hz, and
maximum stations to `1–20`. Volumes stay `0–100`, and the wait bounds stay
`0–2` and `0–5` seconds to match the clamp in `respondWithAllStations`.

Evidence:

- `src/js/settings/validation.js`
- `src/index.html`, numeric bounds and `invalid-feedback` elements
- `tests/unit/settings/inputs.test.js`
- `tests/integration/session/session.test.js`

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

## 10. FIXED: Farnsworth above the character speed compresses spacing

Status: Fixed on `v1-defect-3-input-ranges`

Severity: Medium

The player swapped in the Farnsworth unit for letter and word gaps whenever
Farnsworth was enabled, without checking that the effective speed was slower
than the station's character speed. A faster effective speed therefore produced
gaps narrower than standard timing rather than no effect. At 20 WPM with an
effective speed of 40, `AE E` ran in 0.81 s instead of 1.20 s, with the letter
gap halved from 0.18 s to 0.09 s while the dot and dash lengths stayed correct.

This was reachable because Effective Speed spans the same range as Min and Max
Speed, and each calling station draws its own speed from that range. QRS was
never affected, since both of its branches only lower the value. The fix caps
the effective speed at the character speed in the player, and stores the capped
value on generated stations so the results table reports what was sent.

Evidence:

- `src/js/audio/player.js`, `createMorsePlayer`
- `src/js/stations/generator.js`, `getCallingStation`
- `tests/unit/audio/morse-player.test.js`
- `tests/unit/stations/stationGenerator.test.js`
