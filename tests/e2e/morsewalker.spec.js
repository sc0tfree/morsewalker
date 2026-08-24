import { expect, test } from '@playwright/test';

import {
  audioSnapshot,
  configureValidInputs,
  installTestEnvironment,
  openApp,
  releaseAudio,
  selectMode,
  setRandom,
} from './helpers.js';

const modeJourneys = [
  {
    activeAfterCompletion: '1',
    extra: null,
    header: 'Single Mode Results',
    label: 'Single',
    mode: 'single',
  },
  {
    activeAfterCompletion: '0',
    extra: '1',
    header: 'Contest Mode Results',
    info1: '01',
    label: 'Contest',
    mode: 'contest',
  },
  {
    activeAfterCompletion: '0',
    extra: 'AL',
    header: 'POTA Mode Results',
    info1: 'AL',
    label: 'POTA',
    mode: 'pota',
  },
  {
    activeAfterCompletion: '0',
    extra: 'ADAM / AL',
    header: 'SST Mode Results',
    info1: 'Adam',
    info2: 'AL',
    label: 'SST',
    mode: 'sst',
  },
  {
    activeAfterCompletion: '0',
    extra: 'ADAM / 1',
    header: 'CWT Mode Results',
    info1: 'Adam',
    info2: '1',
    label: 'CWT',
    mode: 'cwt',
  },
];

test.beforeEach(async ({ page }) => {
  await installTestEnvironment(page);
});

test('production artifact boots with its required assets and no page errors', async ({
  page,
}) => {
  const pageErrors = [];
  const responseStatuses = new Map();

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    responseStatuses.set(new URL(response.url()).pathname, response.status());
  });

  await openApp(page);

  expect(responseStatuses.get('/')).toBe(200);
  expect(responseStatuses.get('/js/app.js')).toBe(200);
  expect(responseStatuses.get('/css/app.css')).toBe(200);

  await configureValidInputs(page, { qrn: 'normal' });
  const staticResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/audio/static.mp3'
  );
  await page.locator('#cqButton').click();

  const staticResponse = await staticResponsePromise;
  expect(staticResponse.status()).toBe(200);
  expect(responseStatuses.get('/audio/static.mp3')).toBe(200);
  await expect
    .poll(async () => (await audioSnapshot(page)).bufferSources)
    .toBeGreaterThan(0);

  await expect(page.locator('#activeStations')).toHaveText('1');
  expect(pageErrors).toEqual([]);
});

for (const journey of modeJourneys) {
  test(`${journey.label} completes a deterministic mode-specific journey`, async ({
    page,
  }) => {
    await openApp(page);
    await configureValidInputs(page);
    await selectMode(page, journey.mode);

    await expect(page.locator('#modeResultsHeader')).toHaveText(journey.header);

    if (journey.mode === 'single') {
      await page.keyboard.press('Control+Shift+C');
    } else {
      await page.locator('#cqButton').click();
    }

    await expect(page.locator('#activeStations')).toHaveText('1');
    await releaseAudio(page);

    const responseField = page.locator('#responseField');
    await responseField.fill('k0a');
    await responseField.press('Enter');

    if (journey.mode !== 'single') {
      await expect(page.locator('#infoField')).toBeFocused();
      await releaseAudio(page);
      await page.locator('#infoField').fill(journey.info1);

      let finalInfoField = page.locator('#infoField');
      if (journey.info2) {
        finalInfoField = page.locator('#infoField2');
        await finalInfoField.fill(journey.info2);
      }

      await setRandom(page, 0.9);
      await finalInfoField.press('Enter');
    }

    const row = page.locator('#resultsTable tbody tr').first();
    const cells = row.locator('td');

    await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);
    await expect(cells.nth(0)).toHaveText('1');
    await expect(cells.nth(1)).toHaveText('K0A');
    await expect(cells.nth(2)).toHaveText('18');
    await expect(cells.nth(3)).toHaveText('1');
    await expect(page.locator('#activeStations')).toHaveText(
      journey.activeAfterCompletion
    );
    await expect(responseField).toHaveValue('');

    if (journey.extra === null) {
      await expect(cells).toHaveCount(5);
    } else {
      await expect(cells).toHaveCount(6);
      await expect(cells.nth(5)).toContainText(journey.extra);
    }
  });
}

test('AGN repeats one then all CWT fields and records each count', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'cwt');

  const agnButton = page.locator('#agnButton');
  const infoField = page.locator('#infoField');
  const infoField2 = page.locator('#infoField2');

  await expect(agnButton).toBeVisible();
  await expect(agnButton).toBeDisabled();

  await page.locator('#cqButton').click();
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();

  await expect(infoField).toBeFocused();
  await expect(agnButton).toBeEnabled();
  await releaseAudio(page);

  await infoField.fill('Adam');
  await infoField2.focus();
  const oneFieldEvents = (await audioSnapshot(page)).scheduledEvents;
  await agnButton.click();

  await expect(infoField2).toBeFocused();
  await expect(infoField).toHaveValue('Adam');
  await expect(infoField2).toHaveValue('');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  await expect
    .poll(async () => (await audioSnapshot(page)).scheduledEvents)
    .toBeGreaterThan(oneFieldEvents);

  await releaseAudio(page);
  await infoField.fill('');
  const allFieldEvents = (await audioSnapshot(page)).scheduledEvents;
  await agnButton.click();

  await expect(infoField).toBeFocused();
  await expect(infoField).toHaveValue('');
  await expect(infoField2).toHaveValue('');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  await expect
    .poll(async () => (await audioSnapshot(page)).scheduledEvents)
    .toBeGreaterThan(allFieldEvents);

  await releaseAudio(page);
  await infoField.fill('Adam');
  await infoField2.fill('1');
  await expect(agnButton).toBeDisabled();

  await setRandom(page, 0.9);
  await page.locator('#tuButton').click();

  const cells = page.locator('#resultsTable tbody tr').first().locator('td');
  await expect(cells.nth(3)).toHaveText('3');
  await expect(cells.nth(5)).toContainText('ADAM (1 AGN) / 1 (2 AGN)');
});

test('AGN controls and Help retain their responsive layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'cwt');

  const desktopActions = await page
    .locator('#agnButton, #tuButton')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      })
    );
  expect(desktopActions[0].x).toBeLessThan(desktopActions[1].x);
  expect(Math.abs(desktopActions[0].y - desktopActions[1].y)).toBeLessThan(2);

  await page.locator('[data-bs-target="#helpModal"]').click();
  await expect(page.locator('#helpModal')).toBeVisible();
  await expect(page.locator('#helpModal .col-xl-4')).toHaveCount(6);
  await expect(page.locator('#modeInfoHelpCard button')).toHaveText('AGN');
  await expect(page.locator('#modeInfoHelpCard')).toContainText(
    'AGN does not log or advance the QSO'
  );

  const desktopHelpColumns = await page
    .locator('#helpModal .col-xl-4')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, y: rect.y };
      })
    );
  expect(
    Math.abs(desktopHelpColumns[0].y - desktopHelpColumns[1].y)
  ).toBeLessThan(2);
  expect(
    Math.abs(desktopHelpColumns[1].y - desktopHelpColumns[2].y)
  ).toBeLessThan(2);
  expect(
    Math.abs(desktopHelpColumns[3].y - desktopHelpColumns[4].y)
  ).toBeLessThan(2);
  expect(
    Math.abs(desktopHelpColumns[4].y - desktopHelpColumns[5].y)
  ).toBeLessThan(2);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHelpColumns = await page
    .locator('#helpModal .col-xl-4')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, y: rect.y };
      })
    );
  for (let index = 1; index < mobileHelpColumns.length; index += 1) {
    expect(mobileHelpColumns[index].y).toBeGreaterThan(
      mobileHelpColumns[index - 1].y
    );
  }
  expect(
    Math.max(...mobileHelpColumns.map(({ width }) => width)) -
      Math.min(...mobileHelpColumns.map(({ width }) => width))
  ).toBeLessThan(2);

  await page.locator('#helpModal [data-bs-dismiss="modal"]').last().click();
  await expect(page.locator('#helpModal')).toBeHidden();

  const mobileControls = await page
    .locator('#infoField, #infoField2, #agnButton, #tuButton')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top,
        };
      })
    );
  for (const control of mobileControls) {
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(390);
  }
  for (let first = 0; first < mobileControls.length; first += 1) {
    for (let second = first + 1; second < mobileControls.length; second += 1) {
      const a = mobileControls[first];
      const b = mobileControls[second];
      const overlaps =
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      expect(overlaps).toBe(false);
    }
  }
});

test('repeat, partial, and QRS requests recover into a completed contact', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page);
  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');

  const responseField = page.locator('#responseField');
  for (const response of ['?', 'K', 'QRS']) {
    const scheduledBefore = (await audioSnapshot(page)).scheduledEvents;
    await releaseAudio(page);
    await responseField.fill(response);
    await responseField.press('Enter');

    await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
    await expect
      .poll(async () => (await audioSnapshot(page)).scheduledEvents)
      .toBeGreaterThan(scheduledBefore);
  }

  expect((await audioSnapshot(page)).oscillators).toBe(3);

  await releaseAudio(page);
  await responseField.fill('K0A');
  await responseField.press('Enter');

  const cells = page.locator('#resultsTable tbody tr').first().locator('td');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);
  await expect(cells.nth(1)).toHaveText('K0A');
  await expect(cells.nth(2)).toHaveText('18 / 12');
  await expect(cells.nth(3)).toHaveText('4');
});

test('invalid CQ is rejected before a station or audio starts', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page);
  await page.locator('#yourCallsign').fill('');
  await page.locator('#cqButton').click();

  await expect(page.locator('#yourCallsign')).toHaveClass(/is-invalid/);
  await expect(page.locator('#yourCallsign + .invalid-feedback')).toHaveText(
    'Your callsign is required.'
  );
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  expect((await audioSnapshot(page)).scheduledEvents).toBe(0);
});

test('Reset, mode switching, and persisted station settings survive a reload', async ({
  page,
}) => {
  await openApp(page);
  await configureValidInputs(page);

  await page.locator('#cqButton').click();
  await releaseAudio(page);
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(1);

  await page.locator('#resetButton').click();
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#responseField')).toHaveValue('');
  await expect(page.locator('#cqButton')).toBeEnabled();

  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  await page.locator('#stopButton').click();
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#cqButton')).toBeEnabled();

  await releaseAudio(page);
  await page.locator('#cqButton').click();
  await expect(page.locator('#activeStations')).toHaveText('1');
  await page.locator('#responseField').fill('stale');
  await selectMode(page, 'cwt');

  await expect(page.locator('#modeResultsHeader')).toHaveText(
    'CWT Mode Results'
  );
  await expect(page.locator('#activeStations')).toHaveText('0');
  await expect(page.locator('#responseField')).toHaveValue('');
  await expect(page.locator('#infoField')).toHaveAttribute(
    'placeholder',
    'Name'
  );
  await expect(page.locator('#infoField2')).toHaveAttribute(
    'placeholder',
    'CW Ops No.'
  );

  await page.locator('#yourCallsign').fill('W1AW');
  await page.locator('#yourName').fill('MAYA');
  await page.locator('#yourState').fill('TX');
  await page.locator('#yourSpeed').fill('24');
  await page.locator('#yourSidetone').fill('650');
  await page.locator('#yourVolume').fill('55');

  await page.reload();
  await expect
    .poll(async () => (await audioSnapshot(page)).statsRequests.length)
    .toBe(1);
  const [{ body: statsBody }] = (await audioSnapshot(page)).statsRequests;

  expect(JSON.parse(statsBody)).toEqual({
    callsign: 'W1AW',
    mode: 'cwt',
  });
  await expect(page.locator('#modeCwt')).toBeChecked();
  await expect(page.locator('#modeResultsHeader')).toHaveText(
    'CWT Mode Results'
  );
  await expect(page.locator('#yourCallsign')).toHaveValue('W1AW');
  await expect(page.locator('#yourName')).toHaveValue('MAYA');
  await expect(page.locator('#yourState')).toHaveValue('TX');
  await expect(page.locator('#yourSpeed')).toHaveValue('24');
  await expect(page.locator('#yourSidetone')).toHaveValue('650');
  await expect(page.locator('#yourVolume')).toHaveValue('55');
});
