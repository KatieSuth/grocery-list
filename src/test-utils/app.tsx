import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { getAppDatabase, type AppDatabase } from '@/db/database';

import { createTestDatabase } from './db';
import { simulateSortableDrop } from './sortables-mock';

/**
 * Renders the real app (src/app) against a fresh in-memory database.
 * The calling test file must `jest.mock('@/db/database', ...)` so getAppDatabase is a mock.
 */
export async function renderApp(options: { initialUrl?: string; seed?: (db: AppDatabase) => Promise<void> } = {}) {
  const db = await createTestDatabase();
  await options.seed?.(db);
  jest.mocked(getAppDatabase).mockResolvedValue(db);
  await renderRouterWithRouteHelpers(options.initialUrl);
  return db;
}

const ROUTE_HELPERS = [
  'getPathname',
  'getPathnameWithParams',
  'getSegments',
  'getSearchParams',
  'getRouterState',
] as const;

/**
 * SDK 57 shim; delete when back on SDK 58. SDK 57's renderRouter predates async render(): it
 * attaches its route helpers to the promise it returns rather than to `screen`, which the
 * toHavePathname matchers read. Copy them across.
 */
async function renderRouterWithRouteHelpers(initialUrl?: string) {
  const rendering = renderRouter('./src/app', { initialUrl }) as unknown as Promise<unknown> &
    Record<(typeof ROUTE_HELPERS)[number], () => unknown>;
  await rendering;
  for (const name of ROUTE_HELPERS) {
    (screen as unknown as Record<string, unknown>)[name] = rendering[name];
  }
}

export const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));

export const type = async (label: string, text: string) =>
  fireEvent.changeText(await screen.findByLabelText(label), text);

/**
 * Retries `check` while letting pending database writes finish. Use for DB assertions after a
 * fire-and-forget write; don't await DB queries inside waitFor (it overlaps act() calls).
 */
export async function eventually(check: () => Promise<void>, attempts = 50): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await check();
      return;
    } catch (error) {
      if (i >= attempts) throw error;
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10);
      });
    }
  }
}

/** Moves a department with its screen-reader action ("Move up" / "Move down") on the drag handle. */
export async function moveDepartment(name: string, direction: 'up' | 'down'): Promise<void> {
  const handle = await screen.findByLabelText(new RegExp(`^Reorder ${name},`));
  await fireEvent(handle, 'accessibilityAction', {
    nativeEvent: { actionName: direction === 'up' ? 'moveUp' : 'moveDown' },
  });
}

/** Simulates dragging the department at `fromIndex` and dropping it at `toIndex`. */
export async function dragDepartment(fromIndex: number, toIndex: number): Promise<void> {
  await act(async () => simulateSortableDrop(fromIndex, toIndex));
}

/** The screen-reader actions offered on a department's drag handle. */
export function departmentActions(name: string): string[] {
  const handle = screen.getByLabelText(new RegExp(`^Reorder ${name},`));
  return (handle.props.accessibilityActions as { name: string }[]).map((a) => a.name);
}
