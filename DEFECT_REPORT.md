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

## 4. FIXED: Maximum tone is exclusive

Status: Fixed on `v1-defect-4-max-tone`

Severity: Low

The baseline caller tone generation omitted the inclusive range adjustment
before flooring, so a configured 400–900 Hz range produced at most 899 Hz. The
fix samples uniformly from every integer in the configured range, including
Maximum Tone.

Evidence:

- `src/js/stations/generator.js`, `getCallingStation`
- `tests/unit/stations/stationGenerator.test.js`

## 5. EXPECTED: Callsign-matching criteria intentionally overlap

Status: Documentation corrected on `v1-defect-5-callsign-matching-docs`

Severity: None

The matcher evaluates its criteria as alternatives. A query that fails one
criterion can therefore return `partial` through another: `ABC`/`ABX` matches
criterion 5, `ABCDE`/`AB` matches criterion 1, and `ABCDE`/`ABCDEFX` matches
criterion 4.

This is expected behavior. A `partial` result asks the matching station to
repeat its callsign; it does not accept the callsign as correct or advance the
contact. The stale commented expectations were corrected to describe the
aggregate matcher, and the implementation and active test assertions remain
unchanged.

Evidence:

- `src/js/stations/matching.js`
- `src/js/session/index.js`, partial-match handling in `send`
- `tests/integration/session/session.test.js`
- `tests/unit/stations/util.test.js`

## 6. EXPECTED: Result summaries average all data rows

Status: Documentation corrected

Severity: None

The table header is separate from the result data and is not included in the
summary. After removing the previous summary row, the implementation averages
every data row, including result number one. The summary intentionally appears
only after two results have been recorded.

This is expected behavior. The stale comments saying the first result row was
excluded were corrected, while the implementation and characterization tests
remain unchanged.

Evidence:

- `src/js/results/table.js`, `updateSummaryRow`
- `tests/unit/results/util-results.test.js`

## 7. FIXED: Resetting active QRN re-locks the replacement audio context

Status: Fixed on `v1-defect-7-qrn-lifecycle`

Severity: Medium

The baseline QRN fade extended the foreground audio lock. Because
`stopAllAudio` replaced the foreground context before starting that fade, the
fade wrote a new deadline into the replacement context and silently blocked an
immediate CQ, Send, or TU.

The fix makes the foreground lock exclusive to Morse scheduling. QRN tracks
retire synchronously, fade and stop on the background context's timeline, and
clean up only their own captured nodes. An immediate CQ can therefore load a
replacement while the previous QRN fades, without a stale callback stopping
the replacement. Stopping during a pending load also prevents that load from
starting QRN afterward.

Evidence:

- `src/js/audio/lifecycle.js`
- `src/js/audio/background-static.js`, `stopBackgroundStatic`
- `tests/unit/audio/background-static.test.js`
- `tests/integration/session/session.test.js`

## 8. FIXED: State persistence relies on a browser-created global

Status: Fixed on `v1-defect-8-state-persistence`

Severity: Low

The persistence code referenced `yourState` without declaring or querying it.
Named access on `Window` exposes element IDs in modern browsers, so this was not
a current browser compatibility failure. It nevertheless left initialization
dependent on an implicit global and required lint and test accommodations.

The fix queries the state input with the other station settings and passes it
explicitly to the persistence wiring. The implicit-global accommodations were
removed.

Evidence:

- `src/js/session/index.js`
- `src/js/settings/storage.js`
- `eslint.config.mjs`
- `tests/integration/session/session.test.js`

## 9. FIXED: An unrecognized stored mode prevents startup

Status: Fixed on `v1-defect-9-stored-mode`

Severity: Medium

The baseline read the saved mode from local storage without checking that the
application still knew it. An unrecognized value matched no radio button,
leaving the HTML-default Single radio visibly selected while the session kept
the stale value internally. The UI configuration lookup then missed and threw,
and later session actions would fail on the same missing mode. Values containing
selector syntax could throw even earlier while locating the radio.

The fix accepts only exact IDs from the mode registry, otherwise falls back to
Single and removes the stale key. It synchronizes the radio buttons by comparing
their values directly, so stored text is never treated as a selector. Telemetry,
UI setup, and session logic now all receive the same validated mode.

Evidence:

- `src/js/session/index.js`, mode initialization on `DOMContentLoaded`
- `src/js/modes/index.js`, registered mode IDs
- `src/js/modes/view.js`, `applyModeSettings`
- `tests/integration/session/session.test.js`

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

## 11. FIXED: QRN cannot be re-enabled after selecting Off

Status: Fixed on `v1-defect-7-qrn-lifecycle`

Severity: Medium

The baseline used the presence of a QRN source to decide whether intensity
changes should do anything. During an active session, selecting Off stopped and
cleared the source. A later selection of Normal, Moderate, or Heavy then saw no
source and returned without starting one, leaving QRN stuck off.

The fix tracks active-session QRN intent separately from the current source.
Off can now silence QRN while preserving that intent, so selecting any audible
level starts a replacement. Setting changes before the first CQ or after an
audio reset remain silent until CQ starts a session.

Evidence:

- `src/js/audio/background-static.js`, `updateStaticIntensity`
- `tests/unit/audio/background-static.test.js`
- `tests/integration/session/session.test.js`
