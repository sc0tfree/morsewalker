import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

import { buildStation } from '../helpers/stations.js';
import { configureValidInputs, selectMode } from './helpers.js';

test.use({ launchOptions: { args: ['--mute-audio'] } });

async function readPlayerFactory() {
  const source = await readFile(
    resolve(process.cwd(), 'src/js/audio/player.js'),
    'utf8'
  );
  const runtimeImport = "import { audioContext } from './runtime.js';\n";
  expect(source.startsWith(runtimeImport)).toBe(true);

  // Bind the real player to a native offline context; keep its implementation intact.
  return source
    .replace(runtimeImport, '')
    .replace('export function createMorsePlayer', 'function createMorsePlayer');
}

for (const enableFarnsworth of [false, true]) {
  for (const muteSource of ['station volume', 'volume override']) {
    test(`native rendering is silent for zero ${muteSource}, Farnsworth ${enableFarnsworth}`, async ({
      page,
    }) => {
      const source = await readPlayerFactory();

      for (const qsb of [false, true]) {
        await test.step(`QSB ${qsb}`, async () => {
          const station = buildStation({
            volume: muteSource === 'station volume' ? 0 : 0.7,
            enableFarnsworth,
            farnsworthSpeed: 10,
            qsb,
          });
          const result = await page.evaluate(
            async ({ source, station, volumeOverride }) => {
              Math.random = () => 0.25;

              async function render(configuration, override) {
                const sampleRate = 48000;
                const context = new globalThis.OfflineAudioContext(
                  1,
                  sampleRate * 4,
                  sampleRate
                );
                const createMorsePlayer = new Function(
                  'audioContext',
                  `${source}\nreturn createMorsePlayer;`
                )(context);
                const player = createMorsePlayer(configuration, override);
                const endTime = player.playSentence('AE E', 0.05);
                const buffer = await context.startRendering();
                let peak = 0;
                let nonZeroSamples = 0;
                let nonFiniteSamples = 0;
                for (const sample of buffer.getChannelData(0)) {
                  if (!Number.isFinite(sample)) nonFiniteSamples++;
                  if (sample !== 0) nonZeroSamples++;
                  peak = Math.max(peak, Math.abs(sample));
                }
                return { endTime, peak, nonZeroSamples, nonFiniteSamples };
              }

              return {
                muted: await render(station, volumeOverride),
                audible: await render({ ...station, volume: 0.7 }, null),
              };
            },
            {
              source,
              station,
              volumeOverride: muteSource === 'volume override' ? 0 : null,
            }
          );

          expect(result.muted.nonFiniteSamples).toBe(0);
          expect(result.muted.nonZeroSamples).toBe(0);
          expect(result.muted.peak).toBe(0);
          expect(result.muted.endTime).toBeGreaterThan(0.05);
          expect(result.muted.endTime).toBeLessThan(4);
          expect(result.muted.endTime).toBe(result.audible.endTime);
          expect(result.audible.nonFiniteSamples).toBe(0);
          expect(result.audible.nonZeroSamples).toBeGreaterThan(100);
          expect(result.audible.peak).toBeGreaterThan(0.01);
        });
      }
    });
  }
}

async function observeNativeAudio(page) {
  await page.addInitScript(() => {
    const NativeAudioContext = globalThis.AudioContext;
    const records = [];

    // Observe native scheduling without replacing audio nodes or the audio clock.
    class ObservedAudioContext extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        this.record = {
          id: records.length,
          context: this,
          gains: [],
          oscillators: 0,
          lastScheduledTime: null,
        };
        records.push(this.record);
      }

      createOscillator() {
        const oscillator = super.createOscillator();
        this.record.oscillators++;
        return oscillator;
      }

      createGain() {
        const gain = super.createGain();
        const events = [];
        const record = this.record;
        record.gains.push(events);
        for (const method of [
          'setValueAtTime',
          'exponentialRampToValueAtTime',
          'linearRampToValueAtTime',
        ]) {
          const nativeMethod = gain.gain[method].bind(gain.gain);
          gain.gain[method] = (value, time) => {
            const result = nativeMethod(value, time);
            events.push({ method, value, time });
            record.lastScheduledTime = Math.max(
              record.lastScheduledTime ?? 0,
              time
            );
            return result;
          };
        }
        return gain;
      }
    }

    globalThis.AudioContext = ObservedAudioContext;
    Math.random = () => 0;
    globalThis.__nativeMorseTest = {
      snapshot() {
        const active = records.filter(
          ({ context }) => context.state !== 'closed'
        );
        return {
          contexts: records.map(({ id, context, gains, oscillators }) => ({
            id,
            state: context.state,
            currentTime: context.currentTime,
            oscillators,
            gainCount: gains.length,
            eventCount: gains.reduce(
              (total, events) => total + events.length,
              0
            ),
            firstScheduledTime: gains[0]?.[0]?.time ?? null,
          })),
          gains: active.flatMap(({ gains }) => gains),
          eventCount: active.reduce(
            (count, { gains }) =>
              count + gains.reduce((total, events) => total + events.length, 0),
            0
          ),
        };
      },
      idle(tailSeconds = 0.2) {
        // A muted event marks symbol start. At 60 WPM, allow the final dash
        // (60 ms) plus its inter-letter gap (60 ms), with a small margin.
        // Slower callers need a longer tail before another session action.
        return records.every(
          ({ context, lastScheduledTime }) =>
            context.state === 'closed' ||
            lastScheduledTime === null ||
            context.currentTime >= lastScheduledTime + tailSeconds
        );
      },
    };
  });
  await page.route('**/api/submit', (route) =>
    route.fulfill({ status: 204, body: '' })
  );
}

async function waitForNativeAudio(page, tailSeconds = 0.2) {
  await page.waitForFunction(
    (tail) => globalThis.__nativeMorseTest.idle(tail),
    tailSeconds
  );
}

function expectFiveWpmCallsign(events, earliestTime) {
  const characters = ['-.-', '-----', '.-']; // K0A
  expect(events).toHaveLength(60);
  for (const [index, event] of events.entries()) {
    expect(Number.isFinite(event.value)).toBe(true);
    expect(Number.isFinite(event.time)).toBe(true);
    expect(event.time).toBeGreaterThanOrEqual(earliestTime);
    if (index > 0) {
      expect(event.time).toBeGreaterThanOrEqual(events[index - 1].time);
    }
  }

  let symbolIndex = 0;
  let previousEnd = null;
  for (const character of characters) {
    for (const [index, symbol] of [...character].entries()) {
      const envelope = events.slice(symbolIndex * 6, (symbolIndex + 1) * 6);
      const start = envelope[0].time;
      // The final zero is 1 ms after the nominal end of the symbol.
      const end = envelope[4].time;
      expect(envelope.map(({ method }) => method)).toEqual([
        'setValueAtTime',
        'exponentialRampToValueAtTime',
        'setValueAtTime',
        'setValueAtTime',
        'exponentialRampToValueAtTime',
        'setValueAtTime',
      ]);
      expect(envelope.map(({ value }) => value)).toEqual([
        0.001, 0.5, 0.5, 0.5, 0.001, 0,
      ]);
      expect(end - start).toBeCloseTo(symbol === '-' ? 0.72 : 0.24, 8);
      if (previousEnd !== null) {
        expect(start - previousEnd).toBeCloseTo(index === 0 ? 0.72 : 0.24, 8);
      }
      previousEnd = end;
      symbolIndex++;
    }
  }
}

for (const mode of ['single', 'contest']) {
  test(`native Web Audio QRS floor preserves ordered five-WPM timing in ${mode}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeNativeAudio(page);
    await page.goto('/');
    await configureValidInputs(page, {
      yourCallsign: 'E',
      yourSpeed: '60',
      minSpeed: '5',
      maxSpeed: '5',
    });
    await selectMode(page, mode);
    await page.locator('#cqButton').click();
    await expect(page.locator('#activeStations')).toHaveText('1');
    const afterCq = await page.evaluate(() =>
      globalThis.__nativeMorseTest.snapshot()
    );
    expect(afterCq.gains).toHaveLength(2);
    expectFiveWpmCallsign(afterCq.gains[1], 0);

    for (const request of ['first', 'repeated']) {
      await test.step(`${request} QRS`, async () => {
        // Keep the real clock and wait through the full 720 ms final letter gap.
        await waitForNativeAudio(page, 0.75);
        await page.locator('#responseField').fill('QRS');
        const before = await page.evaluate(() =>
          globalThis.__nativeMorseTest.snapshot()
        );
        const foreground = before.contexts.find(
          (context) => context.state === 'running' && context.oscillators > 0
        );
        await page.locator('#sendButton').click();
        const after = await page.evaluate(() =>
          globalThis.__nativeMorseTest.snapshot()
        );

        expect(after.contexts).toHaveLength(before.contexts.length);
        expect(
          after.contexts.find(({ id }) => id === foreground.id)
        ).toMatchObject({
          state: 'running',
          oscillators: foreground.oscillators + 1,
          gainCount: foreground.gainCount + 1,
        });
        expect(after.gains).toHaveLength(before.gains.length + 1);
        // Earlier caller players retain their original schedules.
        expect(after.gains.slice(1, -1)).toEqual(before.gains.slice(1));
        const callerEvents = after.gains.at(-1);
        expectFiveWpmCallsign(callerEvents, foreground.currentTime);

        const operatorEvents = after.gains[0].slice(before.gains[0].length);
        expect(operatorEvents).toHaveLength(60);
        const operatorSymbolEnd = operatorEvents.at(-2).time;
        expect(callerEvents[0].time - operatorSymbolEnd).toBeCloseTo(
          0.06 + (mode === 'single' ? 0.25 : 0),
          8
        );
        await expect(page.locator('#activeStations')).toHaveText('1');
        await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }

    await page.locator('#stopButton').click();
    expect(errors).toEqual([]);
  });
}

test('native Web Audio numeric parsing schedules scientific-notation speeds and completes a contact', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await observeNativeAudio(page);
  await page.goto('/');
  await configureValidInputs(page, {
    yourCallsign: 'E',
    yourSpeed: '0.5e2',
    minSpeed: '6e1',
    maxSpeed: '6e1',
  });
  await selectMode(page, 'contest');
  await expect(page.locator('#yourSpeed')).toHaveValue('0.5e2');
  await expect(page.locator('#minSpeed')).toHaveValue('6e1');
  await expect(page.locator('#maxSpeed')).toHaveValue('6e1');
  await page.locator('#cqButton').click();

  expect(errors).toEqual([]);
  await expect(page.locator('#activeStations')).toHaveText('1');
  const afterCq = await page.evaluate(() =>
    globalThis.__nativeMorseTest.snapshot()
  );
  expect(afterCq.gains).toHaveLength(2);
  const expectOrderedFiniteEvents = (events) => {
    expect(events.length).toBeGreaterThan(0);
    events.forEach(({ value, time }, index) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isFinite(time)).toBe(true);
      expect(time).toBeGreaterThanOrEqual(0);
      if (index > 0) {
        expect(time).toBeGreaterThanOrEqual(events[index - 1].time);
      }
    });
  };
  for (const [index, symbols, wpm] of [
    [0, ['-.-.', '--.-', '-', '.', '...', '-', '-..', '.', '.'].join(''), 50],
    [1, ['-.-', '-----', '.-'].join(''), 60],
  ]) {
    // CQ TEST DE E and K0A: six gain events per audible symbol.
    const events = afterCq.gains[index];
    expectOrderedFiniteEvents(events);
    expect(events).toHaveLength(symbols.length * 6);
    [...symbols].forEach((symbol, symbolIndex) => {
      const start = events[symbolIndex * 6].time;
      const nominalEnd = events[symbolIndex * 6 + 4].time;
      expect(nominalEnd - start).toBeCloseTo(
        ((symbol === '-' ? 3 : 1) * 1.2) / wpm,
        8
      );
    });
  }

  await waitForNativeAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await expect(page.locator('#infoField')).toBeFocused();
  await waitForNativeAudio(page);
  await page.locator('#infoField').fill('01');
  await page.evaluate(() => {
    Math.random = () => 0.9;
  });
  await page.locator('#tuButton').click();

  const rows = page.locator('#resultsTable tbody tr');
  await expect(rows).toHaveCount(1);
  const cells = rows.first().locator('td');
  await expect(cells.nth(1)).toHaveText('K0A');
  await expect(cells.nth(2)).toHaveText('60');
  await expect(cells.nth(3)).toHaveText('1');
  await expect(cells.nth(5)).toHaveText('1');
  await expect(page.locator('#activeStations')).toHaveText('0');
  const completed = await page.evaluate(() =>
    globalThis.__nativeMorseTest.snapshot()
  );
  expect(completed.eventCount).toBeGreaterThan(afterCq.eventCount);
  completed.gains.forEach(expectOrderedFiniteEvents);
  expect(errors).toEqual([]);
});

test('native Web Audio Stop discards a selected exchange and immediately accepts fresh CQ', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await observeNativeAudio(page);
  await page.goto('/');
  await configureValidInputs(page, {
    yourCallsign: 'E',
    yourSpeed: '60',
    minSpeed: '60',
    maxSpeed: '60',
  });
  await selectMode(page, 'contest');
  await page.locator('#cqButton').click();
  await waitForNativeAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await waitForNativeAudio(page);
  await expect(page.locator('#infoField')).toBeFocused();
  await expect(page.locator('#agnButton')).toBeEnabled();
  await page.locator('#infoField').fill('01');

  const beforeStop = await page.evaluate(() =>
    globalThis.__nativeMorseTest.snapshot()
  );
  const oldForeground = beforeStop.contexts.find(
    (context) => context.state === 'running' && context.oscillators > 0
  );
  expect(oldForeground.oscillators).toBe(2);
  await page.locator('#stopButton').click();
  const afterStop = await page.evaluate(() =>
    globalThis.__nativeMorseTest.snapshot()
  );
  const stoppedFields = await page
    .locator('#responseField, #infoField, #infoField2')
    .evaluateAll((fields) => fields.map((field) => field.value));
  const activeAfterStop = await page.locator('#activeStations').textContent();
  const replacement = afterStop.contexts.at(-1);
  expect(replacement.id).not.toBe(oldForeground.id);
  expect(
    afterStop.contexts.find(({ id }) => id === oldForeground.id).state
  ).toBe('closed');
  expect(replacement.oscillators).toBe(0);
  expect(replacement.eventCount).toBe(0);

  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  // Dispatch also exercises handler guards when the corresponding button is disabled.
  await page.locator('#agnButton').dispatchEvent('click');
  await page.locator('#tuButton').dispatchEvent('click');
  await page.locator('#infoField').press('Enter');
  const afterBlockedActions = await page.evaluate(() =>
    globalThis.__nativeMorseTest.snapshot()
  );
  for (const context of afterStop.contexts) {
    expect(
      afterBlockedActions.contexts.find(({ id }) => id === context.id)
    ).toMatchObject({
      oscillators: context.oscillators,
      gainCount: context.gainCount,
      eventCount: context.eventCount,
    });
  }
  expect(afterBlockedActions.contexts).toHaveLength(afterStop.contexts.length);
  expect(stoppedFields).toEqual(['', '', '']);
  expect(activeAfterStop).toBe('0');
  await expect(page.locator('#agnButton')).toBeDisabled();
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  expect(errors).toEqual([]);

  // Do not wait for the old context's timestamps before restarting.
  const beforeRestart = afterBlockedActions.contexts.find(
    ({ id }) => id === replacement.id
  );
  await page.locator('#cqButton').click();
  const afterRestart = await page.evaluate(() =>
    globalThis.__nativeMorseTest.snapshot()
  );
  const restarted = afterRestart.contexts.find(
    ({ id }) => id === replacement.id
  );
  expect(restarted.oscillators).toBe(2);
  expect(restarted.gainCount).toBe(2);
  expect(restarted.eventCount).toBeGreaterThan(0);
  expect(restarted.firstScheduledTime).toBeGreaterThanOrEqual(
    beforeRestart.currentTime + 2
  );
  expect(restarted.firstScheduledTime).toBeLessThanOrEqual(
    restarted.currentTime + 2
  );
  expect(
    afterRestart.contexts.find(({ id }) => id === oldForeground.id).eventCount
  ).toBe(oldForeground.eventCount);
  await expect(page.locator('#activeStations')).toHaveText('1');

  await waitForNativeAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await waitForNativeAudio(page);
  await page.locator('#infoField').fill('01');
  await page.evaluate(() => {
    Math.random = () => 0.9;
  });
  await page.locator('#tuButton').click();

  const rows = page.locator('#resultsTable tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator('td').nth(1)).toHaveText('K0A');
  await expect(rows.first().locator('td').nth(2)).toHaveText('60');
  await expect(rows.first().locator('td').nth(3)).toHaveText('1');
  await expect(rows.first().locator('td').nth(5)).toHaveText('1');
  await expect(page.locator('#activeStations')).toHaveText('0');
  const completed = await page.evaluate(() =>
    globalThis.__nativeMorseTest.snapshot()
  );
  expect(
    completed.contexts.find(({ id }) => id === oldForeground.id).eventCount
  ).toBe(oldForeground.eventCount);
  expect(
    completed.contexts.find(({ id }) => id === replacement.id).eventCount
  ).toBeGreaterThan(restarted.eventCount);
  expect(errors).toEqual([]);
});

for (const scenario of [
  { name: 'sidetone', yourVolume: '0', callerVolume: '50' },
  { name: 'caller', yourVolume: '70', callerVolume: '0' },
  { name: 'sidetone and caller', yourVolume: '0', callerVolume: '0' },
]) {
  test(`native Web Audio completes a contact with zero ${scenario.name} volume`, async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeNativeAudio(page);
    await page.goto('/');
    await configureValidInputs(page, {
      yourSpeed: '60',
      minSpeed: '60',
      maxSpeed: '60',
      yourVolume: scenario.yourVolume,
      minVolume: scenario.callerVolume,
      maxVolume: scenario.callerVolume,
    });
    await selectMode(page, 'contest');
    await page.locator('#cqButton').click();

    expect(errors).toEqual([]);
    await expect(page.locator('#activeStations')).toHaveText('1');
    const afterCq = await page.evaluate(() =>
      globalThis.__nativeMorseTest.snapshot()
    );
    expect(afterCq.gains).toHaveLength(2);
    for (const [index, volume] of [
      scenario.yourVolume,
      scenario.callerVolume,
    ].entries()) {
      expect(afterCq.gains[index].length).toBeGreaterThan(0);
      expect(afterCq.gains[index].some(({ value }) => value > 0)).toBe(
        volume !== '0'
      );
    }

    await waitForNativeAudio(page);
    await page.locator('#responseField').fill('K0A');
    await page.locator('#sendButton').click();
    await expect(page.locator('#infoField')).toBeFocused();
    const afterSend = await page.evaluate(() =>
      globalThis.__nativeMorseTest.snapshot()
    );
    expect(afterSend.eventCount).toBeGreaterThan(afterCq.eventCount);

    await waitForNativeAudio(page);
    await page.locator('#infoField').fill('01');
    await page.evaluate(() => {
      Math.random = () => 0.9;
    });
    await page.locator('#tuButton').click();

    const rows = page.locator('#resultsTable tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td').nth(1)).toHaveText('K0A');
    await expect(rows.first().locator('td').nth(2)).toHaveText('60');
    await expect(rows.first().locator('td').nth(5)).toHaveText('1');
    await expect(page.locator('#activeStations')).toHaveText('0');
    expect(
      await page.evaluate(
        () => globalThis.__nativeMorseTest.snapshot().eventCount
      )
    ).toBeGreaterThan(afterSend.eventCount);
    expect(errors).toEqual([]);
  });
}
