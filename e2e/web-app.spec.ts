import { expect, test, type Page } from '@playwright/test';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/** Fails the test on any console error or uncaught exception. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

async function setUpOneStoreAndItem(page: Page) {
  await page.goto('/');
  await expect(page.getByText('No stores yet')).toBeVisible({ timeout: 90_000 });

  await button(page, 'Add a store').click();
  await page.getByLabel('Store name').fill('Corner Market');
  await page.getByLabel('New department').fill('Bakery');
  await button(page, 'Add department').click();
  await button(page, 'Move Bakery up').click();
  await button(page, 'Save').click();
  await expect(page.getByText('Produce → Deli → Bakery → Frozen')).toBeVisible();

  await button(page, 'Next').click();
  await expect(page.getByText('No items yet')).toBeVisible();
  await button(page, 'Add an item').click();
  await page.getByLabel('Item name').fill('Milk');
  await page.getByRole('checkbox', { name: 'Corner Market' }).click();
  await page.getByRole('radio', { name: 'Deli in Corner Market' }).click();
  await button(page, 'Continue').click();
  await expect(page.getByText('Corner Market · Deli')).toBeVisible();

  await button(page, 'Finish').click();
  await expect(page.getByText('Shopping trips are coming soon')).toBeVisible();
}

test('first-run setup, then the main app tabs', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);

  // Bottom tab bar.
  await expect(page.getByRole('tab', { name: 'Trip' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Stores' }).click();
  await expect(page).toHaveURL(/\/stores$/);
  await expect(page.getByText('Produce → Deli → Bakery → Frozen')).toBeVisible();
  await page.getByRole('tab', { name: 'Items' }).click();
  await expect(page).toHaveURL(/\/items$/);
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toBeVisible();

  expect(problems).toEqual([]);
});

test('checked items and quantities survive a reload', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);

  await page.getByRole('tab', { name: 'Items' }).click();
  await page.getByRole('checkbox', { name: 'Milk' }).click();
  await page.getByLabel('Quantity for Milk').fill('1/2 gallon');
  // Saves happen as you type; give the write a moment before reloading.
  await page.waitForTimeout(500);

  await page.reload();
  await expect(page.getByLabel('Quantity for Milk')).toHaveValue('1/2 gallon', { timeout: 60_000 });
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toHaveAttribute('aria-checked', 'true');

  // Unchecking clears it.
  await page.getByRole('checkbox', { name: 'Milk' }).click();
  await expect(page.getByLabel('Quantity for Milk')).toHaveCount(0);

  expect(problems).toEqual([]);
});

test('deleting asks with the browser confirm dialog', async ({ page }) => {
  await setUpOneStoreAndItem(page);
  await page.getByRole('tab', { name: 'Items' }).click();
  await page.getByRole('button', { name: 'Milk' }).click();

  page.once('dialog', (d) => d.dismiss());
  await button(page, 'Delete item').click();
  await expect(page.getByLabel('Item name')).toHaveValue('Milk');

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Delete Milk?');
    void d.accept();
  });
  await button(page, 'Delete item').click();
  await expect(page.getByText('No items yet')).toBeVisible();
});

test('a new store can reuse departments from other stores', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);

  await page.getByRole('tab', { name: 'Stores' }).click();
  await button(page, 'Add a store').click();
  await page.getByLabel('Store name').fill('Big Box');
  await page.getByLabel('New department').fill('bak');
  await button(page, 'Use Bakery').click();
  await expect(page.getByLabel('New department')).toHaveValue('Bakery');
  await expect(button(page, 'Remove Bakery')).toHaveCount(0);
  await button(page, 'Add department').click();
  await expect(button(page, 'Remove Bakery')).toBeVisible();
  await expect(page.getByLabel('New department')).toHaveValue('');
  await button(page, 'Save').click();
  await expect(page.getByText('Produce → Deli → Frozen → Bakery')).toBeVisible();

  expect(problems).toEqual([]);
});
