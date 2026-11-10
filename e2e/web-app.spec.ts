import { expect, test, type Locator, type Page } from '@playwright/test';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/** Waits until an element has stopped moving (e.g. a newly added row animating into place). */
async function settledBox(locator: Locator) {
  let previous = await locator.boundingBox();
  for (let i = 0; i < 20; i++) {
    await locator.page().waitForTimeout(100);
    const current = await locator.boundingBox();
    if (current && previous && current.x === previous.x && current.y === previous.y) return current;
    previous = current;
  }
  throw new Error('Element kept moving');
}

/** Drags a department by its handle and drops it on another department's row. */
async function dragDepartment(page: Page, name: string, onto: string) {
  const from = await settledBox(page.getByLabel(new RegExp(`^Reorder ${name},`)));
  const to = await settledBox(page.getByLabel(new RegExp(`^Reorder ${onto},`)));
  const x = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  // Go a little past the target's center, as a finger would, so the swap clearly triggers.
  const endY = to.y + to.height / 2 + Math.sign(to.y - from.y) * (to.height / 2);
  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.waitForTimeout(300); // the library's drag activation delay
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, startY + ((endY - startY) * i) / steps);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(200);
  await page.mouse.up();
}

/** Fails the test on any console error or uncaught exception. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

async function addDepartment(page: Page, name: string) {
  await page.getByLabel('New department').fill(name);
  await button(page, 'Add department').click();
  await expect(button(page, `Remove ${name}`)).toBeVisible();
}

async function setUpOneStoreAndItem(page: Page) {
  await page.goto('/');
  await expect(page.getByText('No stores yet')).toBeVisible({ timeout: 90_000 });

  await button(page, 'Add a store').click();
  await page.getByLabel('Store name').fill('Corner Market');
  // New stores start with no departments, and show an example instead.
  await expect(page.getByText('No departments yet. For example: Produce, Deli, Frozen.')).toBeVisible();
  for (const name of ['Produce', 'Deli', 'Frozen', 'Bakery']) {
    await addDepartment(page, name);
  }
  await expect(page.getByText(/No departments yet/)).toHaveCount(0);
  // Produce, Deli, Frozen, Bakery → drag Bakery onto Frozen.
  await dragDepartment(page, 'Bakery', 'Frozen');
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
  // The main app opens on the Items tab.
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toBeVisible();
}

test('first-run setup, then the main app tabs', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);

  // Bottom tab bar: Items first, and it's where the app opens ("/").
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  for (const [i, name] of ['Items', 'Trip', 'Stores', 'Settings'].entries()) {
    await expect(tabs.nth(i)).toHaveAccessibleName(name);
  }
  await expect(page.getByRole('tab', { name: 'Items' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/:\d+\/$/);

  await page.getByRole('tab', { name: 'Trip' }).click();
  await expect(page).toHaveURL(/\/trip$/);
  await expect(page.getByText('Where are you shopping?')).toBeVisible();
  await page.getByRole('tab', { name: 'Stores' }).click();
  await expect(page).toHaveURL(/\/stores$/);
  await expect(page.getByText('Produce → Deli → Bakery → Frozen')).toBeVisible();
  await page.getByRole('tab', { name: 'Items' }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
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
  await expect(page.getByText('Big Box')).toBeVisible();
  await expect(page.getByText('Bakery', { exact: true })).toBeVisible();

  expect(problems).toEqual([]);
});

test('a store can copy all departments from another store', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);

  await page.getByRole('tab', { name: 'Stores' }).click();
  await button(page, 'Add a store').click();
  await page.getByLabel('Store name').fill('Big Box');
  await button(page, 'Copy departments from another store').click();

  const dialog = page.getByRole('dialog', { name: 'Copy departments from' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Copy from Corner Market' }).click();
  await expect(dialog).toHaveCount(0);
  // The new store had none, so all four are copied, in Corner Market's order.
  await expect(
    page.getByText('Copied 4 departments from Corner Market: Produce, Deli, Bakery, Frozen.')
  ).toBeVisible();
  await button(page, 'Save').click();
  await expect(page.getByText('Big Box')).toBeVisible();
  // Both stores now list the same departments.
  await expect(page.getByText('Produce → Deli → Bakery → Frozen')).toHaveCount(2);

  expect(problems).toEqual([]);
});

test('the master list can be searched and filtered', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);

  // A second item in another department.
  await page.getByRole('tab', { name: 'Items' }).click();
  await button(page, 'Add an item').click();
  await page.getByLabel('Item name').fill('Bagels');
  await page.getByLabel('Brand').fill('Acme');
  await page.getByRole('checkbox', { name: 'Corner Market' }).click();
  await page.getByRole('radio', { name: 'Bakery in Corner Market' }).click();
  await button(page, 'Continue').click();
  await expect(page.getByRole('checkbox', { name: 'Bagels' })).toBeVisible();

  // Search by name, then clear with ✕.
  await page.getByLabel('Search items').fill('mil');
  await expect(page.getByRole('checkbox', { name: 'Bagels' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toBeVisible();
  await expect(page.getByText('Showing 1 of 2 items')).toBeVisible();
  await button(page, 'Clear search').click();
  await expect(page.getByLabel('Search items')).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: 'Bagels' })).toBeVisible();

  // Filter by department, then clear.
  await button(page, 'Sort and filter, by name, A to Z').click();
  await expect(page.getByRole('checkbox', { name: 'Departments: Bakery' })).toHaveCount(0);
  await button(page, 'Departments').click();
  await page.getByRole('checkbox', { name: 'Departments: Bakery' }).click();
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Bagels' })).toBeVisible();
  await expect(page.getByText('1 filter on')).toBeVisible();
  await button(page, 'Clear filters').click();
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toBeVisible();

  // Show only checked, then only unchecked items.
  await page.getByRole('checkbox', { name: 'Milk' }).click();
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toBeChecked();
  await page.getByRole('radio', { name: 'Checked items only', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Bagels' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toBeVisible();
  await page.getByRole('radio', { name: 'Unchecked items only' }).click();
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Bagels' })).toBeVisible();
  await button(page, 'Clear filters').click();
  await expect(page.getByRole('checkbox', { name: 'Milk' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Milk' }).click();
  await expect(page.getByRole('checkbox', { name: 'Milk' })).not.toBeChecked();

  // Sort by department: grouped under headings, departments A–Z.
  await button(page, 'Sort and filter, by name, A to Z').click(); // close the panel, so its chips aren't counted below
  await button(page, 'Add an item').click();
  await page.getByLabel('Item name').fill('Apples');
  await page.getByRole('checkbox', { name: 'Corner Market' }).click();
  await page.getByRole('radio', { name: 'Produce in Corner Market' }).click();
  await button(page, 'Continue').click();
  const itemOrder = () =>
    expect.poll(() => page.getByRole('checkbox').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))));
  await itemOrder().toEqual(['Apples', 'Bagels', 'Milk']);

  await button(page, 'Sort and filter, by name, A to Z').click();
  await page.getByRole('radio', { name: 'Z to A' }).click();
  await itemOrder().toEqual(['Milk', 'Bagels', 'Apples']);
  await page.getByRole('radio', { name: 'A to Z' }).click();
  await page.getByRole('radio', { name: 'Sort by department' }).click();
  await expect(button(page, 'Sort and filter, by department, A to Z')).toBeVisible();
  // The first heading is the screen title.
  await expect(page.getByRole('heading')).toHaveText(['Items', 'Bakery', 'Deli', 'Produce']);
  await itemOrder().toEqual(['Bagels', 'Milk', 'Apples']);

  expect(problems).toEqual([]);
});

test('an item in two departments shows under both, sharing its check and quantity', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);

  // Milk is in Corner Market's Deli; put it in Big Box's Frozen too.
  await page.getByRole('tab', { name: 'Stores' }).click();
  await button(page, 'Add a store').click();
  await page.getByLabel('Store name').fill('Big Box');
  await addDepartment(page, 'Frozen');
  await button(page, 'Save').click();
  await expect(page.getByText('Big Box')).toBeVisible();
  await page.getByRole('tab', { name: 'Items' }).click();
  await button(page, 'Milk').click();
  await page.getByRole('checkbox', { name: 'Big Box' }).click();
  await page.getByRole('radio', { name: 'Frozen in Big Box' }).click();
  await button(page, 'Save').click();

  await button(page, 'Sort and filter, by name, A to Z').click();
  await page.getByRole('radio', { name: 'Sort by department' }).click();
  await expect(page.getByRole('heading')).toHaveText(['Items', 'Deli', 'Frozen']);
  const boxes = page.getByRole('checkbox', { name: 'Milk' });
  await expect(boxes).toHaveCount(2);

  // Check under Deli: both copies are checked.
  await boxes.first().click();
  await expect(boxes.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(boxes.nth(1)).toHaveAttribute('aria-checked', 'true');

  // Typing under one copy shows in the other, both ways.
  const quantities = page.getByLabel('Quantity for Milk');
  await quantities.nth(0).fill('2 gallons');
  await expect(quantities.nth(1)).toHaveValue('2 gallons');
  await quantities.nth(1).fill('1 gallon');
  await expect(quantities.nth(0)).toHaveValue('1 gallon');

  // It's saved: still there after a reload.
  await page.reload();
  await button(page, 'Sort and filter, by name, A to Z').click();
  await page.getByRole('radio', { name: 'Sort by department' }).click();
  await expect(page.getByLabel('Quantity for Milk')).toHaveCount(2);
  await expect(page.getByLabel('Quantity for Milk').nth(1)).toHaveValue('1 gallon');

  expect(problems).toEqual([]);
});

test('a shopping trip: choose a store, check off, finish', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page); // Corner Market: Produce → Deli → Bakery → Frozen; Milk in Deli

  // A second store, and a second item at Corner Market.
  await page.getByRole('tab', { name: 'Stores' }).click();
  await button(page, 'Add a store').click();
  await page.getByLabel('Store name').fill('Big Box');
  await addDepartment(page, 'Frozen');
  await button(page, 'Save').click();
  await expect(page.getByText('Big Box')).toBeVisible();
  await page.getByRole('tab', { name: 'Items' }).click();
  await button(page, 'Add an item').click();
  await page.getByLabel('Item name').fill('Apples');
  await page.getByRole('checkbox', { name: 'Corner Market' }).click();
  await page.getByRole('radio', { name: 'Produce in Corner Market' }).click();
  await button(page, 'Continue').click();

  // Check both on the master list, with a quantity for Milk.
  await page.getByRole('checkbox', { name: 'Milk' }).click();
  await page.getByRole('checkbox', { name: 'Apples' }).click();
  await page.getByLabel('Quantity for Milk').fill('2');

  await page.getByRole('tab', { name: 'Trip' }).click();
  await button(page, 'Choose a store').click();
  await page.getByRole('dialog', { name: 'Which store are you at?' }).getByRole('button', { name: 'Corner Market' }).click();
  await expect(button(page, 'Store: Corner Market')).toBeVisible();
  const trip = page.getByTestId('trip-screen');
  await expect(trip.getByRole('heading')).toHaveText(['Produce', 'Deli']);
  await page.getByRole('switch', { name: 'Reverse order' }).click();
  await expect(trip.getByRole('heading')).toHaveText(['Deli', 'Produce']);

  await trip.getByRole('checkbox', { name: 'Milk, 2' }).click();
  await expect(page.getByText('1 of 2 in cart')).toBeVisible();

  // Switching stores with something in the cart: "not yet" keeps us here.
  page.once('dialog', (d) => {
    expect(d.message()).toContain('Done with your trip at Corner Market?');
    void d.dismiss();
  });
  await button(page, 'Store: Corner Market').click();
  await page.getByRole('dialog', { name: 'Which store are you at?' }).getByRole('button', { name: 'Big Box' }).click();
  await expect(button(page, 'Store: Corner Market')).toBeVisible();
  await expect(trip.getByRole('checkbox', { name: 'Milk, 2' })).toHaveAttribute('aria-checked', 'true');

  // Finish, confirming in the browser dialog.
  page.once('dialog', (d) => {
    expect(d.message()).toContain('Finish your trip at Corner Market?');
    void d.accept();
  });
  await button(page, 'Finish trip').click();
  await expect(page.getByText('Trip finished: 1 item logged as bought.')).toBeVisible();
  await expect(trip.getByRole('checkbox')).toHaveCount(1);

  // Milk is unchecked on the master list and shows when it was bought; Apples is still checked.
  await page.getByRole('tab', { name: 'Items' }).click();
  const items = page.getByTestId('master-list');
  await expect(items.getByText('Last bought today')).toBeVisible();
  await expect(items.getByRole('checkbox', { name: 'Milk' })).toHaveAttribute('aria-checked', 'false');
  await expect(items.getByRole('checkbox', { name: 'Apples' })).toHaveAttribute('aria-checked', 'true');

  // Sorting by last bought puts Milk first, and Apples under "Never bought".
  await page.getByRole('button', { name: /^Sort and filter, / }).click();
  await page.getByRole('radio', { name: 'Sort by last bought' }).click();
  await expect(page.getByRole('radio', { name: 'Newest first' })).toHaveAttribute('aria-checked', 'true');
  await expect(items.getByRole('heading', { name: 'Never bought' })).toBeVisible();
  await expect
    .poll(() => items.getByRole('checkbox').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))))
    .toEqual(['Milk', 'Apples']);

  expect(problems).toEqual([]);
});

test('settings: dark mode sticks across reloads; deleting all data starts over', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);

  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  const settings = page.getByTestId('settings-screen');
  await expect(page.getByRole('radio', { name: 'Match system appearance' })).toHaveAttribute('aria-checked', 'true');
  await expect(settings).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  await page.getByRole('radio', { name: 'Dark mode' }).click();
  await expect(settings).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');

  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true', { timeout: 60_000 });
  await expect(page.getByTestId('settings-screen')).toHaveCSS('background-color', 'rgb(0, 0, 0)');

  // Dismissing the confirmation keeps everything.
  page.once('dialog', (d) => d.dismiss());
  await button(page, 'Delete all data').click();
  await expect(page).toHaveURL(/\/settings$/);

  page.once('dialog', (d) => {
    expect(d.message()).toContain('Delete all data?');
    void d.accept();
  });
  await button(page, 'Delete all data').click();
  await expect(page.getByText('No stores yet')).toBeVisible();

  // Gone from storage too, not just hidden; the dark choice is kept.
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => Object.values(localStorage).join('\n'));
  expect(stored).not.toContain('Corner Market');
  expect(stored).not.toContain('Milk');
  await page.reload();
  await expect(page.getByText('No stores yet')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');

  expect(problems).toEqual([]);
});

test('settings: a CSV file adds stores, departments and items; a bad file changes nothing', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);
  await page.getByRole('tab', { name: 'Settings' }).click();

  /** Picks a CSV in the browser's file chooser and returns the dialogs it led to. */
  async function importCsv(contents: string, answer: 'accept' | 'dismiss') {
    const dialogs: string[] = [];
    const handler = (d: import('@playwright/test').Dialog) => {
      dialogs.push(d.message());
      void (answer === 'accept' ? d.accept() : d.dismiss());
    };
    page.on('dialog', handler);
    const chooser = page.waitForEvent('filechooser');
    await button(page, 'Import from CSV').click();
    await (await chooser).setFiles({ name: 'list.csv', mimeType: 'text/csv', buffer: Buffer.from(contents) });
    return { dialogs, done: () => page.off('dialog', handler) };
  }

  // A row with no department: explained, and nothing is added.
  const bad = await importCsv('Store,Item name,Department,Brand\nAldi,Apples,\n', 'accept');
  await expect.poll(() => bad.dialogs).toEqual(['Can’t import this file\n\nRow 2: Department is empty.\n\nNothing was imported.']);
  bad.done();

  // Cancelling the question adds nothing either.
  const cancelled = await importCsv('Aldi,Apples,Produce', 'dismiss');
  await expect.poll(() => cancelled.dialogs).toHaveLength(1);
  cancelled.done();

  const good = await importCsv(
    '﻿Store,Item name,Department,Brand\r\nCorner Market,Milk,Deli\r\nCorner Market,"Bread, sourdough",Bakery,Acme\r\nAldi,Apples,Produce\r\n',
    'accept'
  );
  await expect
    .poll(() => good.dialogs)
    .toEqual([
      'Import from CSV?\n\nThis adds 2 new items, 1 new store and 1 new department. 1 row is already in your list and will be skipped.',
      'Imported\n\nAdded 2 new items, 1 new store and 1 new department.',
    ]);
  good.done();

  await page.getByRole('tab', { name: 'Items' }).click();
  const items = page.getByTestId('master-list');
  await expect(page.getByText('Corner Market · Bakery')).toBeVisible();
  await expect(page.getByText('Aldi · Produce')).toBeVisible();
  await expect(page.getByText('Bread, sourdough')).toBeVisible();
  await expect(items.getByRole('checkbox', { name: 'Apples' })).toBeVisible();

  await page.getByRole('tab', { name: 'Stores' }).click();
  await expect(page.getByText('Produce → Deli → Bakery → Frozen')).toBeVisible();

  expect(problems).toEqual([]);
});

test('settings: the items list’s default sort is remembered across reloads', async ({ page }) => {
  const problems = watchConsole(page);
  await setUpOneStoreAndItem(page);
  const sortButton = page.getByRole('button', { name: /^Sort and filter, / });
  await expect(sortButton).toHaveAttribute('aria-label', 'Sort and filter, by name, A to Z');

  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Default sort: last bought' }).click();
  await page.getByRole('radio', { name: 'Default order: Oldest first' }).click();
  await expect(page.getByRole('radio', { name: 'Default order: Oldest first' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('tab', { name: 'Items' }).click();
  await expect(sortButton).toHaveAttribute('aria-label', 'Sort and filter, by last bought, Oldest first');

  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('button', { name: /^Sort and filter, / })).toHaveAttribute(
    'aria-label',
    'Sort and filter, by last bought, Oldest first',
    { timeout: 60_000 }
  );

  expect(problems).toEqual([]);
});
