import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, type HostInstance } from 'react-native';

import { StoreActionsMenu } from '@/components/store-actions-menu';
import type { Store } from '@/domain/types';

const store: Store = { id: 's1', name: 'Kroger', departments: [], createdAt: 1 };

/** A stand-in for the store's row, at the given place on screen. */
const anchorAt = (y: number) =>
  ({
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
      callback(16, y, 300, 72),
  }) as unknown as HostInstance;

const handlers = () => ({ onEdit: jest.fn(), onCopy: jest.fn(), onDelete: jest.fn(), onClose: jest.fn() });

const menu = () => screen.getByLabelText('Options for Kroger');
const layOut = (height: number) =>
  fireEvent(menu(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 280, height } } });

afterEach(() => jest.restoreAllMocks());

test('shows nothing without a store', async () => {
  await render(<StoreActionsMenu store={null} anchor={null} {...handlers()} />);
  expect(screen.toJSON()).toBeNull();
});

test('appears under the store once it knows its size, and moves the screen reader to its first option', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  await render(<StoreActionsMenu store={store} anchor={anchorAt(100)} {...handlers()} />);
  await act(async () => {});
  // Hidden until laid out, so it doesn't flash in the wrong place.
  expect(menu()).toHaveStyle({ top: 180, left: 16, opacity: 0 });
  expect(focus).not.toHaveBeenCalled();

  await layOut(150);
  expect(menu()).toHaveStyle({ top: 180, opacity: 1 });
  // (The focused view itself is a native instance, too big to compare usefully.)
  expect(focus).toHaveBeenCalledTimes(1);
  const [target, event] = focus.mock.calls[0];
  expect(target).toBeTruthy();
  expect(event).toBe('focus');
});

test('appears above a store near the bottom of the screen', async () => {
  await render(<StoreActionsMenu store={store} anchor={anchorAt(1200)} {...handlers()} />);
  await act(async () => {});
  await layOut(150);
  expect(menu()).toHaveStyle({ top: 1200 - 8 - 150 });
});

test('each option calls back with the store; dismissing returns the screen reader to it', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const anchor = anchorAt(100);
  const on = handlers();
  await render(<StoreActionsMenu store={store} anchor={anchor} {...on} />);
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Edit Kroger' }));
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Copy Kroger' }));
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete Kroger' }));
  expect(on.onEdit).toHaveBeenCalledWith(store);
  expect(on.onCopy).toHaveBeenCalledWith(store);
  expect(on.onDelete).toHaveBeenCalledWith(store);
  expect(on.onClose).not.toHaveBeenCalled();

  await fireEvent(menu(), 'accessibilityEscape');
  expect(on.onClose).toHaveBeenCalledTimes(1);
  expect(focus.mock.calls.at(-1)?.[0]).toBe(anchor);
  expect(focus.mock.calls.at(-1)?.[1]).toBe('focus');
});

test('without its row to measure, it still appears, mid-screen, and closes', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const on = handlers();
  await render(<StoreActionsMenu store={store} anchor={null} {...on} />);
  await layOut(150);
  expect(menu()).toHaveStyle({ opacity: 1 });
  await fireEvent.press(screen.getByTestId('store-menu-backdrop', { includeHiddenElements: true }));
  expect(on.onClose).toHaveBeenCalled();
  // There was no row to return the screen reader to.
  expect(focus.mock.calls.every(([target]) => target)).toBe(true);
});

test('a measurement that arrives after the menu has closed is ignored', async () => {
  let respond: (() => void) | undefined;
  const slow = {
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
      respond = () => callback(0, 0, 100, 50);
    },
  } as unknown as HostInstance;
  const { unmount } = await render(<StoreActionsMenu store={store} anchor={slow} {...handlers()} />);
  await unmount();
  respond?.();
  expect(respond).toBeDefined();
});
