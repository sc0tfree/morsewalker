import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

import {
  audioSnapshot,
  configureValidInputs,
  installTestEnvironment,
  openApp,
  selectMode,
  setRandom,
} from './helpers.js';

test.use({ timezoneId: 'America/New_York' });

test.beforeEach(async ({ page }) => {
  await installTestEnvironment(page);
});

test('downloads a dated CSV snapshot without changing the active session', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-08T19:32:07Z'));
  await openApp(page);
  await configureValidInputs(page);
  await selectMode(page, 'contest');

  const exportButton = page.getByRole('button', {
    name: 'Export',
    exact: true,
  });
  await expect(exportButton).toBeDisabled();
  await page.locator('#cqButton').click();

  for (let contact = 1; contact <= 2; contact++) {
    await page.evaluate(() => globalThis.__morseTest.advance(60));
    await page.locator('#responseField').fill('K0A');
    await page.locator('#sendButton').click();
    if (contact === 1) await expect(exportButton).toBeDisabled();
    await page.evaluate(() => globalThis.__morseTest.advance(60));
    await page.locator('#infoField').fill('01');
    await page.locator('#tuButton').click();
    await expect(exportButton).toBeEnabled();
  }

  await expect(page.locator('#resultsTable-summary')).toBeVisible();
  await expect(page.locator('#activeStations')).toHaveText('1');
  // Settle Font Awesome's asynchronous icon replacement before the snapshot.
  await expect(page.locator('#resultsTable tbody svg.fa-check')).toHaveCount(2);
  const beforeRows = await page.locator('#resultsTable tbody').innerHTML();
  const beforeAudio = await audioSnapshot(page);
  const beforeCqDisabled = await page.locator('#cqButton').isDisabled();
  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(
    '2026-11-08_14-32-07_contest_morsewalker.csv'
  );
  const contents = await readFile(await download.path());
  expect([...contents.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(contents.toString('utf8')).toBe(
    '\uFEFFExported At,Mode,#,Callsign,WPM,Attempts,Total Time (s),Exchange\r\n' +
      '2026-11-08T14:32:07-05:00,Contest,2,K0A,18,1,120.00,Correct: 1\r\n' +
      '2026-11-08T14:32:07-05:00,Contest,1,K0A,18,1,120.00,Correct: 1\r\n'
  );
  expect(await page.locator('#resultsTable tbody').innerHTML()).toBe(
    beforeRows
  );
  expect(await audioSnapshot(page)).toEqual(beforeAudio);
  await expect(page.locator('#activeStations')).toHaveText('1');
  expect(await page.locator('#cqButton').isDisabled()).toBe(beforeCqDisabled);

  await page.locator('#stopButton').click();
  await expect(exportButton).toBeEnabled();
  const stoppedDownloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const stoppedDownload = await stoppedDownloadPromise;
  expect(await readFile(await stoppedDownload.path())).toEqual(contents);

  await page.locator('#resetButton').click();
  await expect(exportButton).toBeDisabled();
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);

  await setRandom(page, 0);
  await page.locator('#cqButton').click();
  await page.evaluate(() => globalThis.__morseTest.advance(60));
  await page.locator('#responseField').fill('K0A');
  await page.locator('#sendButton').click();
  await page.evaluate(() => globalThis.__morseTest.advance(60));
  await page.locator('#infoField').fill('01');
  await page.locator('#tuButton').click();
  await expect(exportButton).toBeEnabled();
  await selectMode(page, 'fd');
  await expect(exportButton).toBeDisabled();
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
});

for (const width of [320, 375]) {
  test(`keeps the results heading and export button readable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await openApp(page);
    await selectMode(page, 'fd');
    const heading = page.locator('#modeResultsHeader');
    const exportButton = page.getByRole('button', {
      name: 'Export',
      exact: true,
    });
    await expect(heading).toBeVisible();
    await expect(exportButton).toBeVisible();
    await exportButton.scrollIntoViewIfNeeded();

    const headingBounds = await heading.boundingBox();
    const buttonBounds = await exportButton.boundingBox();
    expect(headingBounds.x).toBeGreaterThanOrEqual(0);
    expect(headingBounds.x + headingBounds.width).toBeLessThanOrEqual(width);
    expect(buttonBounds.x).toBeGreaterThanOrEqual(0);
    expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(width);

    const sitsToRight = buttonBounds.x >= headingBounds.x + headingBounds.width;
    const wrapsBelow = buttonBounds.y >= headingBounds.y + headingBounds.height;
    expect(sitsToRight || wrapsBelow).toBe(true);
    expect(
      await exportButton.evaluate(
        (button) => button.scrollWidth <= button.clientWidth
      )
    ).toBe(true);
  });
}
