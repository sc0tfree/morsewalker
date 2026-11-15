import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

import {
  audioSnapshot,
  configureValidInputs,
  installTestEnvironment,
  openApp,
  releaseAudio,
  selectMode,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await installTestEnvironment(page);
});

for (const { label, width, submit } of [
  { label: 'desktop Enter', width: 1280, submit: 'enter' },
  { label: 'mobile Send', width: 390, submit: 'button' },
]) {
  test(`${label} dismisses a caller, reveals it, and preserves contact numbering`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    await configureValidInputs(page);
    const response = page.locator('#responseField');
    const results = page.locator(
      '#resultsTable tbody tr:not(#resultsTable-summary)'
    );
    await expect(page.locator('#responseFeedback')).toBeHidden();
    await page.locator('#cqButton').click();
    await releaseAudio(page);
    const beforeDismiss = await audioSnapshot(page);

    await response.fill(' nil ');
    if (submit === 'enter') await response.press('Enter');
    else await page.locator('#sendButton').click();

    await expect(results).toHaveCount(1);
    await expect(results.first().locator('td').nth(0)).toHaveText('NIL');
    await expect(results.first().locator('td').nth(1)).toHaveText('K0A');
    await expect(results.first().locator('td').nth(3)).toHaveText('0');
    await expect(page.locator('#activeStations')).toHaveText('1');
    await expect(response).toBeEmpty();
    await expect(response).toBeFocused();
    expect((await audioSnapshot(page)).scheduledEvents).toBeGreaterThan(
      beforeDismiss.scheduledEvents
    );

    // Another submission during the NIL/new-caller playback cannot skip twice.
    await response.fill('NIL');
    await response.press('Enter');
    await expect(results).toHaveCount(1);

    const exportButton = page.getByRole('button', {
      name: 'Export',
      exact: true,
    });
    await expect(exportButton).toBeEnabled();
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;
    const csv = await readFile(await download.path(), 'utf8');
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      '\uFEFFExported At,Mode,#,Callsign,WPM,Attempts,Total Time (s),Exchange'
    );
    expect(lines[1].split(',').slice(1, 6)).toEqual([
      'Single',
      'NIL',
      'K0A',
      '18',
      '0',
    ]);
    expect(lines[1].split(',')[7]).toBe('');

    await releaseAudio(page);
    await response.fill('K0A');
    await response.press('Enter');
    await expect(results).toHaveCount(2);
    await expect(results.first().locator('td').nth(0)).toHaveText('1');
    await expect(results.last().locator('td').nth(0)).toHaveText('NIL');
    await expect(page.locator('#resultsTable-summary')).toHaveCount(0);
    await expect(response).toBeFocused();
  });
}

test('mobile NIL feedback explains idle and ambiguous targets without transmitting', async ({
  page,
}) => {
  const width = 390;
  await page.setViewportSize({ width, height: 900 });
  await openApp(page);
  await configureValidInputs(page, { minStations: '2', maxStations: '2' });
  await selectMode(page, 'contest');

  const response = page.locator('#responseField');
  const feedback = page.locator('#responseFeedback');
  const beforeIdle = await audioSnapshot(page);
  await response.fill('NIL');
  await page.locator('#sendButton').click();
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveText('No caller to dismiss. Call CQ first.');
  await expect(feedback).toHaveAttribute('role', 'status');
  await expect(response).toBeFocused();
  expect(await audioSnapshot(page)).toEqual(beforeIdle);

  await page.locator('#cqButton').click();
  await expect(feedback).toBeHidden();
  await releaseAudio(page);
  await expect(page.locator('#activeStations')).toHaveText('2');
  const beforeAmbiguous = await audioSnapshot(page);
  await response.fill('NIL');
  await response.press('Enter');
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveText(
    'Several callers answered. Send a partial callsign to isolate one, then NIL.'
  );
  await expect(response).toBeFocused();
  await expect(page.locator('#activeStations')).toHaveText('2');
  await expect(page.locator('#resultsTable tbody tr')).toHaveCount(0);
  expect(await audioSnapshot(page)).toEqual(beforeAmbiguous);

  const bounds = await feedback.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  expect(
    await feedback.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true);

  await response.fill('K');
  await expect(feedback).toBeHidden();
});
