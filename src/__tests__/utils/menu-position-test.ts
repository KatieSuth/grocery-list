import { menuPosition } from '@/utils/menu-position';

const area = { width: 400, height: 800, insets: { top: 40, bottom: 30, left: 0, right: 0 } };
const card = (y: number, x = 16) => ({ x, y, width: 368, height: 72 });

test('below the card, lined up with its left edge', () => {
  expect(menuPosition(card(100), undefined, area)).toEqual({ top: 180, left: 16, width: 280 });
  expect(menuPosition(card(100), 160, area)).toEqual({ top: 180, left: 16, width: 280 });
});

test('above the card when there is no room below', () => {
  expect(menuPosition(card(600), 160, area)).toEqual({ top: 432, left: 16, width: 280 });
});

test('kept within the window when it fits neither below nor above', () => {
  expect(menuPosition(card(100), 700, area)).toEqual({ top: 62, left: 16, width: 280 });
  expect(menuPosition(card(100), 760, area)).toEqual({ top: 48, left: 16, width: 280 });
});

test('kept within the window sideways, and narrower on a narrow window', () => {
  expect(menuPosition(card(100, 300), undefined, area).left).toBe(112);
  expect(menuPosition(card(100, -20), undefined, area).left).toBe(8);
  const narrow = { ...area, width: 250, insets: { ...area.insets, left: 10, right: 10 } };
  expect(menuPosition(card(100, 0), undefined, narrow)).toEqual({ top: 180, left: 18, width: 214 });
});
