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
        this.record = { context: this, gains: [], lastScheduledTime: null };
        records.push(this.record);
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
          gains: active.flatMap(({ gains }) => gains),
          eventCount: active.reduce(
            (count, { gains }) =>
              count + gains.reduce((total, events) => total + events.length, 0),
            0
          ),
        };
      },
      idle() {
        // A muted event marks symbol start. At 60 WPM, allow the final dash
        // (60 ms) plus its inter-letter gap (60 ms), with a small margin.
        return records.every(
          ({ context, lastScheduledTime }) =>
            context.state === 'closed' ||
            lastScheduledTime === null ||
            context.currentTime >= lastScheduledTime + 0.2
        );
      },
    };
  });
  await page.route('**/api/submit', (route) =>
    route.fulfill({ status: 204, body: '' })
  );
}

async function waitForNativeAudio(page) {
  await page.waitForFunction(() => globalThis.__nativeMorseTest.idle());
}

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
