# Morsewalker v1 review backlog

Reviewed on November 7, 2026. Items 1–6 are resolved; items 7–11 remain open.

## Scope and merge assessment

- Reviewed branch: `v1-feature-52-persist-preferences` at `1b092df263e4d8577f7b254cb12cfe39e96b4d02`.
- PR: [#123 — Persist practice preferences](https://github.com/sc0tfree/morsewalker/pull/123), targeting `v1` at `99558627480675b0ec08cec0318e2c6f6ef6861b`.
- Broader v1 baseline: `main` at `35f975495156f3b23ab5b7ab6a18d1c0b24df6ad`.
- Source links below are pinned to the reviewed commit. Their line numbers may change after fixes.
- This backlog supplements the existing `DEFECT_REPORT.md`; it does not replace that historical report.

The settings feature covers the full current settings inventory. Merging it into
the development `v1` branch before addressing this backlog is reasonable. This is
a feature-completeness assessment, not a claim that the broader v1 release is free
of defects. Numeric parsing and storage failure handling remain known limitations
of persistence as well as the wider application.

| Area               | Persisted settings                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode               | Selected operating mode                                                                                                                                                 |
| Your Station       | Callsign, name, state, Field Day class and section, speed, sidetone frequency, and volume                                                                               |
| Responding Station | Maximum stations; speed, tone, volume, and wait ranges; Farnsworth toggle and speed; US-only toggle; all six callsign formats; cut-number toggle and all eight mappings |
| Effects            | QRN level, QSB toggle, and QSB percentage                                                                                                                               |

Responding Station and Effects each have a confirmed, section-scoped Defaults
action. Restoration also synchronizes dependent controls, toggle labels, and the
QSB percentage label. Disabled dependent values are retained. Legacy Your Station
keys remain compatible, and malformed preference payloads have fallback behavior.

**Confirmed product decision:** responding-station edits should take effect after
restarting with Stop/CQ, while the current session retains its settings snapshot.
Deferring edits until restart is intentional and is not a review finding. QRN has
its existing live intensity control behavior.

## Findings

Priorities: **P2** denotes a functional defect to address; **P3** denotes a
lower-priority result-accounting defect. Origin identifies whether the defect was
introduced by v1 work or inherited from the beta baseline.

### 1. [P2] Active settings edits can crash the next caller

**Status:** Resolved on November 7, 2026, in `codex/fix-active-settings-player`.
**Origin:** inherited live-form validation conflicted with v1's session-snapshot
behavior.

**Location:** [audio/player.js, lines 19–20](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/audio/player.js#L19-L20).
The undefined player is subsequently assigned and used in `audio/stationMix.js`,
lines 55 and 91.

**Reproduce:** start Field Day with valid own-station settings, select a caller,
clear your own class and section, enter the caller's copied exchange, and press
TU. The result is logged, but when another caller is generated, playback throws
`Cannot read properties of undefined (reading 'playSentence')`. Clearing Min Tone
during Contest and then sending AGN also reproduces the failure.

**Cause at review:** `createMorsePlayer` called `getInputs()` against the live
form despite receiving an existing station. Invalid edits made it return
`undefined` instead of creating a player from the session's station configuration.

**Acceptance:** an active session continues using its snapshot while settings are
edited, including temporarily invalid values; the next explicit restart validates
the new settings. Exercise the real player path. At review, the Field Day snapshot
test at `tests/integration/session/session.test.js:1176` passed with a player mock
that hid this failure.

**Resolution:** removed the `getInputs` import, its live-form read, and the early
return from player creation. Updated the player contract documentation. A token
comparison confirmed those three statement deletions were the only executable
production changes; oscillator setup, envelopes, timing, Farnsworth, QSB, and
scheduling stayed unchanged. CQ continues to validate new settings.

**Verification:** the new unit and browser regressions reproduced the original
failure before the fix and passed afterward. Exact gain events and end times
match for a given station with valid or invalid form settings, including
Farnsworth and QSB. All 360 unit/integration tests and 19 Chromium journeys passed,
along with formatting, lint, and the production build. The four new browser cases
cover Field Day and Single advancing to another caller, Contest AGN and QRS,
and rejection of invalid settings after Stop/CQ. A muted native Chromium Field
Day probe created the next caller and scheduled 60 native gain events without
page errors after the own-station class and section were cleared. This validates
native scheduling, not perceived sound quality. Backlog item 3 remains separate.

### 2. [P2] Enter cannot finish international POTA/SST exchanges

**Status:** Resolved on November 7, 2026, in `codex/fix-international-exchange-enter`.
**Origin:** new AGN workflow regression in v1.

**Location:** [session/index.js, lines 149–154](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/session/index.js#L149-L154).
Fill selection is implemented in `session/fills.js:22`.

**Reproduce:** disable US-only callsigns and work an international caller in POTA,
or in SST after copying the name. Leave its nonexistent state blank and press
Enter. Every Enter sends `STATE?`, receives no state response, and leaves the QSO
open. Clicking TU succeeds and logs `N/A`. Both modes were reproduced with the
deterministic caller `YT9ZZ`.

**Cause at review:** blank input was always considered fillable without checking
whether the caller had that exchange component.

**Acceptance:** international POTA and SST contacts can finish using Enter when
all available information has been copied, while missing available information
still requests the appropriate fill.

**Resolution:** fill selection now checks the selected station's canonical
exchange value as well as the input's existing fill markers. Enter routing, AGN
availability, and fill resolution share that selection rule. Missing stations and
null, undefined, empty, or whitespace-only values are unavailable; numeric zero
remains available. International POTA completes with `N/A`, and SST requests only
the available name before completing with `NAME / N/A`. Unavailable state fields
cannot request fills or accumulate AGN counts, even with `AGN` or `?` entered.
Station generation, transmitted exchange templates, scoring, audio code, and the
Safari activation fix are unchanged.

**Verification:** before the production fix, 13 new unit cases and seven new
international integration cases failed; both US-state integration controls
passed. Both new browser journeys also reproduced the defect: POTA Enter left
the contact unfinished, and SST requested `AGN?` instead of `NAME?`. Afterward,
all 400 unit/integration tests and 21 Chromium journeys passed, along with
formatting, lint, coverage, and the production build. Coverage includes completion
from either SST field, name-only fills, focus, attempts, AGN counts, and unchanged
US-state fills. Browser regressions use the actual player implementation with
the existing Web Audio fake and assert scheduled playback and no page errors.
Existing audio timing and Safari activation expectations pass unchanged. Items
3–11 remained follow-up work after this fix.

### 3. [P2] Rejected CQ overwrites the active settings snapshot

**Status:** Resolved on November 7, 2026, in `codex/fix-rejected-cq-snapshot`.
**Origin:** inherited; the new AGN action adds another affected path.

**Location:** [session/index.js, lines 434–435](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/session/index.js#L434-L435).

**Reproduce:** during Contest, change Min Speed to `0` and click CQ. After
validation rejects it, restore `18` without another CQ and send the caller's
exact callsign. The handler throws because `inputs` is now null. If the caller was
already selected, requesting an AGN fill has the same problem. A successful CQ
recovers.

**Cause at review:** CQ assigned `inputs = getInputs()` before checking
validation, replacing the last validated session settings with `null` when the
form was invalid.

**Acceptance:** a rejected CQ leaves the previous validated session data intact;
subsequent Send, AGN, and TU actions do not dereference a null snapshot.

**Resolution:** CQ now validates into a local `candidateInputs` variable and
assigns it to the active snapshot only after validation succeeds. The block stays
in its original position, preserving validation feedback and successful CQ
behavior. The approved block and its explanatory comment are the only production
changes; audio code, Safari activation, and Stop behavior are unchanged.

**Verification:** three independent Contest integration regressions and three
actual-player Chromium regressions failed before the fix and passed afterward.
Send and component AGN previously threw on `null.enableCutNumbers`; TU threw on
`null.maxStations` after logging the contact. Tests assert that rejected CQ
preserves transmissions, players, callers, results, and copied fields, then verify
continued playback, original cut-number formatting, AGN counts, and new-caller
speed despite pending edits. A later valid CQ control passes before and after the
fix and confirms that newly valid settings are adopted. All 404 unit/integration
tests and 24 Chromium journeys passed, along with formatting, lint, coverage, and
the production build. Existing audio timing and Safari activation expectations
pass unchanged. Items 4–11 remained follow-up work after this fix.

### 4. [P2] Zero volume throws instead of muting

**Status:** Resolved on November 7, 2026, in `codex/fix-zero-volume-muting`.
**Origin:** inherited audio defect.

**Location:** [audio/player.js, lines 247–251](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/audio/player.js#L247-L251).

**Reproduce:** set Sidetone Volume to the permitted value `0` and press CQ.
Native Chromium throws because `exponentialRampToValueAtTime` rejects a zero
target. Zero caller volume reaches the same code path.

**Cause at review:** a zero symbol amplitude was passed into an exponential ramp,
which native Web Audio rejects.

**Acceptance:** zero sidetone and caller volumes are silent and exception-free,
and contacts still advance with the expected scheduling. Use native Web Audio or
a test double that enforces the same constraints; the fake accepted zero at review.

**Resolution:** immediately after calculating symbol volume, an exact-zero guard
sets gain to zero at the symbol start and returns its normal end time. This skips
both ramps for silent symbols, including an exact-zero QSB fade. The guard and its
comment are the entire production change. Oscillator setup, nonzero envelopes,
Morse timing, Farnsworth spacing, QSB calculations, scheduling, and the player
interface are unchanged.

**Verification:** before the fix, nine new unit cases, three actual-player browser
journeys with the stricter fake, and seven native Chromium checks failed on zero
exponential targets. Both unit and browser AudioParam doubles now enforce that
constraint. Afterward, all 413 unit/integration tests and 34 Chromium tests passed,
along with formatting, lint, coverage, and the production build. Coverage includes
zero station volume and overrides with standard/Farnsworth timing, QSB on/off,
zero-only gain events, unchanged end times, and an exact-zero QSB symbol followed
by a normal audible symbol. Before/after comparisons of 20 nonzero configurations
matched every unrounded gain event and end time, including low volumes, QSB, and
Farnsworth. Native OfflineAudioContext renders produced only zero-valued samples
for all eight muted configurations; audible controls produced sound samples with
identical end times. All three mute combinations (sidetone, caller, both) completed
contacts without page errors using both the fake and native Web Audio in muted
Chromium; the Single journeys also scheduled the next caller. Existing audio
timing and Safari activation expectations pass unchanged. Items 5–11 remained
follow-up work after this fix.

### 5. [P2] Stop leaves usable controls attached to closed players

**Status:** Resolved on November 7, 2026, in `codex/fix-stop-session-state`.
**Origin:** inherited audio/session lifecycle defect.

**Location:** [session/index.js, lines 894–901](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/session/index.js#L894-L901).
Players capture their context in `audio/player.js:37` and use its clock at line
324; the foreground runtime is replaced in `audio/runtime.js:31`.

**Reproduce:** start Contest, allow the first exchange to finish, press Stop, then
Send without CQ. The retained player schedules on its closed context. Native
inspection found two oscillators in the old closed context and none in the new
running context. AGN and TU can likewise retain old players.

**Consequence:** playback is silent. A timestamp returned from the old context
can also lock the new context for approximately the elapsed pre-Stop session
duration, which may be minutes.

**Confirmed behavior and acceptance:** Stop discards unfinished callers and copied
exchange fields in every mode while preserving completed results, contact
numbering, mode, and settings. Subsequent nonempty Send, AGN, TU, and exchange-field
Enter must not schedule on closed players or add results. CQ starts fresh with
validated settings; empty Send or callsign-field Enter retains its existing
shortcut to a fresh CQ.

**Resolution:** expanded `stop()` to clear callers, selection, TU readiness,
attempts, contact timing, AGN counts, remembered field focus, and references to
the operator and last responding stations. It clears response/exchange fields,
shows zero callers, disables AGN through the existing availability helper, and
enables CQ. The existing `stopAllAudio()` call and action guards are unchanged.
Updated the Stop documentation and Help sentence. No audio modules, player
envelopes, scheduling, context lifecycle, or Safari activation code changed.

**Verification:** 15 new integration cases and four actual-player Chromium cases
failed before the fix and passed afterward. The native Chromium regression
observed 252 additional gain events on the closed foreground context before the
fix; afterward, its event count stays unchanged through stopped actions and
restart. Coverage includes caller playback in all six modes, selected exchanges
in all five exchange modes, ignored stopped actions, preserved results and
numbering, repeated Stop, Reset, fresh settings, rejected-CQ recovery, and empty
Send/Enter restarts. Browser records retain closed contexts and verify fresh CQ
schedules only on the replacement context without an old-clock lock. Muted native
Chromium also completes the restarted contact with its real clock and existing
CQ delay. All 425 unit/integration tests and 38 Chromium tests passed, along with
formatting, lint, coverage, and the production build. Existing audio timing and
Safari activation expectations pass unchanged. Items 6–11 remained follow-up work
after this fix.

### 6. [P2] First QRS can produce negative spacing

**Status:** Resolved on November 8, 2026, in `codex/fix-first-qrs-speed-floor`.
**Origin:** inherited session defect.

**Locations:** [pileup QRS, session/index.js lines 521–523](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/session/index.js#L521-L523)
and [Single QRS, lines 630–632](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/session/index.js#L630-L632).

**Reproduce:** set caller speed to `5` WPM with Farnsworth disabled and send QRS.
The first request sets effective speed to `-1`; at 6 WPM it produces zero, and at
7–10 WPM it produces values below the intended five-WPM floor.

**Evidence:** native scheduling at 5 WPM placed a later character before an
earlier character, including into the past. The observed K began at 15.586 seconds,
but the following zero began at 14.146 seconds after QRS was invoked at 14.624
seconds. No exception was required for the timing to be corrupted.

**Correction and acceptance:** apply the same lower bound when first enabling
Farnsworth that subsequent QRS requests already apply. Cover first and repeated
QRS at low speeds in both Single and pileup modes; scheduling must remain ordered.

**Resolution:** both first-QRS assignments now use
`Math.max(5, characterWpm - farnsworthLowerBy)`. Those two assignment changes are
the entire production fix. Character speed, subsequent QRS handling, caller
selection, player creation, response delays, and attempt counting are unchanged.
No audio modules, settings, public interfaces, or Safari activation code changed.
A caller already at 5 WPM repeats at `5 / 5`.

**Verification:** the 24-case integration matrix covers Single and Contest at
every character speed from 5 through 12 WPM, the ordinary 18 WPM sequence, and
already-enabled Farnsworth at effective speeds 12, 10, and 5. Before the fix, all
12 first-QRS cases at 5–10 WPM failed; the 12 remaining controls passed. All six
new actual-player Chromium regressions also failed before the fix: 5 WPM
scheduled events out of order (and before the request in native Chromium), while
6 WPM used 0.60-second letter gaps instead of 0.72 seconds because the old zero
value triggered the player's fallback. Afterward, all 448 unit/integration tests
and 44 Chromium tests passed, along with formatting, lint, coverage, and the
production build. Tests verify first and repeated QRS, unchanged dot/dash and
intra-character timing, exact letter spacing, attempts, and completed result
speeds. Muted native Chromium checks both modes at 5 WPM using its real clock and
the full trailing letter gap. An exact source comparison confirms only the two
approved assignments changed in production. Existing audio timing and Safari
activation expectations pass unchanged. Items 7–11 remain follow-up work.

### 7. [P2] Numeric parsing disagrees with validation

**Status:** Open. **Origin:** inherited parsing defect, repeated by the new
preference writer.

**Locations:** [settings/read.js, lines 30–38](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/settings/read.js#L30-L38),
[validation.js, lines 99–105](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/settings/validation.js#L99-L105),
and [storage.js, lines 190–195](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/settings/storage.js#L190-L195).

**Reproduce:** enter Your Speed as `0.5e2`, with otherwise valid settings, and
press CQ. Numeric inputs accept exponent notation. Validation sees 50 through
`Number`, but `parseInt` collects zero WPM. Native Chromium logs a zero-WPM player
and throws a non-finite scheduling error. Ordinary exponent forms are also
misread: `6e1` becomes 6 instead of 60.

**Correction and acceptance:** normalize, validate, use, and persist the same
numeric value. If integer truncation remains intended, apply it to the parsed
number rather than a text prefix. Cover exponent notation, ordinary integers,
decimal settings, and save/reload consistency.

### 8. [P2] Storage failures interrupt application behavior

**Status:** Open. **Origin:** inherited resilience defect; the new persistence
and defaults paths need the same protection.

**Locations:** [session/index.js, lines 410–414](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/session/index.js#L410-L414)
and [settings/storage.js, lines 440–444](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/settings/storage.js#L440-L444).

**Reproduce:** make localStorage access throw `SecurityError`; startup aborts
before the current mode is initialized, and CQ subsequently throws. Separately,
after normal startup, make `setItem` throw `QuotaExceededError` and select Field
Day. The selected/internal mode changes, but the header and exchange controls
retain the previous mode because the exception skips reset and UI application.

**Correction and acceptance:** treat persistence as best effort. Unavailable
storage must not prevent initialization, mode changes, practice, or restoring
defaults in memory. Test throwing reads, writes, and removals in addition to the
existing malformed-JSON cases.

### 9. [P2] Replacing players leaves oscillators running

**Status:** Open. **Origin:** inherited audio resource-lifecycle defect.

**Location:** [audio/stationMix.js, lines 51–55](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/audio/stationMix.js#L51-L55).
`audio/player.js:62–70` creates and starts each oscillator; the returned player at
line 337 exposes no cleanup operation.

**Reproduce and evidence:** run a one-caller Contest and issue ten completed AGN
repeat requests. Native inspection showed growth from two to twelve oscillators
in the same running context, with zero oscillator stops and zero disconnects.
Single mode also creates a player for every next contact without disposing the
previous one. Stop/reset eventually closes the context.

**Correction and acceptance:** explicitly dispose players when retired, or reuse
them where appropriate. Verify bounded live-node counts over many repeats and
contacts without stopping players before their scheduled audio finishes. Node
accumulation was measured; CPU cost and audible degradation were not measured.

### 10. [P3] Re-sending the selected callsign erases fill counts

**Status:** Open. **Origin:** new AGN bookkeeping regression in v1.

**Location:** [session/index.js, lines 577–580](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/session/index.js#L577-L580).

**Reproduce:** select a CWT caller, request AGN, send the same callsign again,
copy both fields, and finish with TU. The result omits the accepted AGN counts
even though the transcript contains the fill and the attempts count retains it.

**Cause and correction:** every exact Send calls `initializeExchangeAgnCounts`,
including reselection of the same unfinished QSO. Preserve the counts for that
contact and initialize them only when starting a genuinely different contact.

**Acceptance:** requesting fills and then re-sending the same callsign preserves
per-field counts; selecting a different caller or finishing/resetting the contact
does not carry those counts into another QSO.

### 11. [P3] First pileup result includes idle time before CQ

**Status:** Open. **Origin:** inherited result-timing defect.

**Location:** [session/index.js, line 825](https://github.com/sc0tfree/morsewalker/blob/1b092df263e4d8577f7b254cb12cfe39e96b4d02/src/js/session/index.js#L825).
The initial pileup CQ does not set the timer, and the first TU initializes it only
after logging the result, at line 852.

**Reproduce:** leave the page idle before starting a pileup-mode session, then
complete the first contact. Its time includes that pre-session idle period
because `currentStationStartTime` is null and subtraction coerces it to zero.
A deterministic probe included 100 seconds of pre-CQ idle in the first result.

**Correction and acceptance:** establish the initial contact's start time when
practice begins, using the intended timing convention. Identical contacts should
produce the same duration regardless of time spent idle before the initial CQ,
and the summary must use the corrected value.

## Validation and remaining release checks

At the reviewed commit:

- `npm run verify` passed formatting, lint, all 359 unit/integration tests,
  coverage collection, and the production build.
- All 15 configured Chromium browser journeys passed against the production
  build. The remote PR quality, core, build, browser, and Cloudflare checks were
  also successful at that same commit.
- Additional targeted session and native Chromium probes reproduced the findings
  above. They were review probes, not permanent additions to the test suite.
- Existing automated audio tests use permissive fake Web Audio objects; their
  success does not establish native API validity or perceived sound quality.
- The original source split showed no confirmed accidental behavior change. The
  Morse mapping and envelope were preserved, while later v1 work deliberately
  changed QSB frequency, Farnsworth bounds, response timing, and QRN lifecycle.
- No additional confirmed defect was found in callsign matching, mode messages,
  preference inventory coverage, or Field Day generation. Field Day exchange and
  section data were checked against the [2026 ARRL rules](https://www.arrl.org/field-day-rules/)
  and [official section list](https://www.arrl.org/files/file/Field-Day/Generic/ARRL-RAC%20Section%20List.pdf).
- Human listening using the checklist in `TESTING.md`, plus Safari/Firefox
  validation, remains outstanding. Prefer narrow fixes that preserve established
  audio behavior and add coverage for the specific failures above.
