import { expect } from '@playwright/test';

const modeRadioIds = {
  contest: 'modeContest',
  cwt: 'modeCwt',
  pota: 'modePota',
  single: 'modeSingle',
  sst: 'modeSst',
};

export async function installTestEnvironment(page) {
  await page.addInitScript(() => {
    const contexts = [];
    const statsRequests = [];
    let randomValue = 0;
    const nativeFetch = globalThis.fetch.bind(globalThis);

    class FakeAudioParam {
      constructor(value = 0) {
        this.value = value;
        this.events = [];
      }

      setValueAtTime(value, time) {
        this.value = value;
        this.events.push({ type: 'set', value, time });
      }

      exponentialRampToValueAtTime(value, time) {
        this.value = value;
        this.events.push({ type: 'exponentialRamp', value, time });
      }

      linearRampToValueAtTime(value, time) {
        this.value = value;
        this.events.push({ type: 'linearRamp', value, time });
      }
    }

    class FakeAudioNode {
      constructor(type) {
        this.type = type;
        this.connections = [];
        this.started = [];
        this.stopped = [];
      }

      connect(node) {
        this.connections.push(node);
        return node;
      }

      disconnect() {
        this.connections = [];
      }

      start(time = 0) {
        this.started.push(time);
      }

      stop(time = 0) {
        this.stopped.push(time);
      }
    }

    class FakeOscillatorNode extends FakeAudioNode {
      constructor() {
        super('oscillator');
        this.frequency = new FakeAudioParam();
      }
    }

    class FakeGainNode extends FakeAudioNode {
      constructor() {
        super('gain');
        this.gain = new FakeAudioParam();
      }
    }

    class FakeBufferSourceNode extends FakeAudioNode {
      constructor() {
        super('bufferSource');
        this.buffer = null;
        this.loop = false;
      }
    }

    class FakeAudioContext {
      constructor() {
        this.currentTime = 0;
        this.destination = new FakeAudioNode('destination');
        this.oscillators = [];
        this.gains = [];
        this.bufferSources = [];
        this.state = 'running';
        contexts.push(this);
      }

      createOscillator() {
        const oscillator = new FakeOscillatorNode();
        this.oscillators.push(oscillator);
        return oscillator;
      }

      createGain() {
        const gain = new FakeGainNode();
        this.gains.push(gain);
        return gain;
      }

      createBufferSource() {
        const source = new FakeBufferSourceNode();
        this.bufferSources.push(source);
        return source;
      }

      decodeAudioData(arrayBuffer) {
        return Promise.resolve({ arrayBuffer });
      }

      close() {
        this.state = 'closed';
        return Promise.resolve();
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
      writable: true,
    });
    Object.defineProperty(globalThis, 'webkitAudioContext', {
      configurable: true,
      value: FakeAudioContext,
      writable: true,
    });

    Math.random = () => randomValue;
    globalThis.fetch = (input, init = {}) => {
      const url =
        typeof input === 'string' ? input : (input?.url ?? String(input));

      if (url.startsWith('https://stats.')) {
        statsRequests.push({
          body: init.body ?? null,
          method: init.method ?? 'GET',
          url,
        });
        return Promise.resolve({ ok: true, status: 204 });
      }

      if (
        /^https?:\/\//.test(url) &&
        !url.startsWith(globalThis.location.origin)
      ) {
        return Promise.reject(new Error(`Unexpected external request: ${url}`));
      }

      return nativeFetch(input, init);
    };

    Object.defineProperty(globalThis, '__morseTest', {
      configurable: true,
      value: {
        advance(seconds = 1000) {
          contexts.forEach((context) => {
            context.currentTime += seconds;
          });
        },
        setRandom(value) {
          randomValue = value;
        },
        snapshot() {
          return {
            bufferSources: contexts.reduce(
              (total, context) => total + context.bufferSources.length,
              0
            ),
            contexts: contexts.length,
            gains: contexts.reduce(
              (total, context) => total + context.gains.length,
              0
            ),
            oscillators: contexts.reduce(
              (total, context) => total + context.oscillators.length,
              0
            ),
            scheduledEvents: contexts.reduce(
              (total, context) =>
                total +
                context.gains.reduce(
                  (gainTotal, gain) => gainTotal + gain.gain.events.length,
                  0
                ),
              0
            ),
            statsRequests: statsRequests.map((request) => ({ ...request })),
          };
        },
      },
    });
  });

  await page.route('**/api/submit', async (route) => {
    await route.fulfill({
      body: '',
      contentType: 'application/json',
      status: 204,
    });
  });
}

export async function openApp(page) {
  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole('heading', { name: /Morse Walker/ })
  ).toBeVisible();
  await expect(page.locator('#modeResultsHeader')).toHaveText(
    'Single Mode Results'
  );
}

export async function configureValidInputs(page, overrides = {}) {
  const settings = {
    maxSpeed: '18',
    maxStations: '1',
    maxTone: '400',
    maxVolume: '50',
    maxWait: '0',
    minSpeed: '18',
    minTone: '400',
    minVolume: '50',
    minWait: '0',
    qrn: 'off',
    yourCallsign: 'N0ME',
    yourName: 'HENRY',
    yourSidetone: '600',
    yourSpeed: '20',
    yourState: 'CA',
    yourVolume: '70',
    ...overrides,
  };

  await page.locator('#yourCallsign').fill(settings.yourCallsign);
  await page.locator('#yourName').fill(settings.yourName);
  await page.locator('#yourState').fill(settings.yourState);
  await page.locator('#yourSpeed').fill(settings.yourSpeed);
  await page.locator('#yourSidetone').fill(settings.yourSidetone);
  await page.locator('#yourVolume').fill(settings.yourVolume);

  await page.evaluate((values) => {
    const updateValue = (id, value) => {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const updateChecked = (id, checked) => {
      const input = document.getElementById(id);
      input.checked = checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    [
      'maxSpeed',
      'maxStations',
      'maxTone',
      'maxVolume',
      'maxWait',
      'minSpeed',
      'minTone',
      'minVolume',
      'minWait',
    ].forEach((id) => updateValue(id, values[id]));

    ['1x1', '1x2', '1x3', '2x1', '2x2', '2x3'].forEach((id) => {
      updateChecked(id, id === '1x1');
    });
    updateChecked('usOnly', true);
    updateChecked('qsb', false);
    updateChecked('enableFarnsworth', false);
    updateChecked('enableCutNumbers', false);
    updateChecked('qrnOff', values.qrn === 'off');
    updateChecked('qrnNormal', values.qrn === 'normal');
    updateChecked('qrnModerate', values.qrn === 'moderate');
    updateChecked('qrnHeavy', values.qrn === 'heavy');
  }, settings);
}

export async function selectMode(page, mode) {
  const radioId = modeRadioIds[mode];
  await page.locator(`label[for="${radioId}"]`).click();
  await expect(page.locator(`#${radioId}`)).toBeChecked();
}

export async function releaseAudio(page) {
  await page.evaluate(() => globalThis.__morseTest.advance());
}

export async function setRandom(page, value) {
  await page.evaluate(
    (nextValue) => globalThis.__morseTest.setRandom(nextValue),
    value
  );
}

export async function audioSnapshot(page) {
  return page.evaluate(() => globalThis.__morseTest.snapshot());
}
