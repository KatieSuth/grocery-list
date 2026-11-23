import type { WindowRect } from './measure';

export type MenuPosition = { top: number; left: number; width: number };

type Area = {
  /** The window's size. */
  width: number;
  height: number;
  /** Space taken by system bars, notches and so on, which the menu stays clear of. */
  insets: { top: number; bottom: number; left: number; right: number };
};

/** Space kept between the menu and the window's edges, and between the menu and what it's for. */
export const MENU_MARGIN = 8;
export const MENU_MAX_WIDTH = 280;

/**
 * Where to show a dropdown menu for `anchor`: just below it, lined up with its left edge, or just
 * above it if there's no room below. It's kept within the window (above the bottom if it fits
 * nowhere else). Before the menu's height is known, it's placed below.
 */
export function menuPosition(anchor: WindowRect, menuHeight: number | undefined, area: Area): MenuPosition {
  const minLeft = area.insets.left + MENU_MARGIN;
  const maxRight = area.width - area.insets.right - MENU_MARGIN;
  const width = Math.min(MENU_MAX_WIDTH, maxRight - minLeft);
  const left = Math.max(minLeft, Math.min(anchor.x, maxRight - width));

  const minTop = area.insets.top + MENU_MARGIN;
  const maxBottom = area.height - area.insets.bottom - MENU_MARGIN;
  const below = anchor.y + anchor.height + MENU_MARGIN;
  if (menuHeight === undefined || below + menuHeight <= maxBottom) return { top: below, left, width };
  const above = anchor.y - MENU_MARGIN - menuHeight;
  if (above >= minTop) return { top: above, left, width };
  return { top: Math.max(minTop, maxBottom - menuHeight), left, width };
}
