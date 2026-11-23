import type { HostInstance } from 'react-native';

/** Moves keyboard and screen-reader focus to `view` (a DOM element on the web). */
export function moveAccessibilityFocus(view: HostInstance): void {
  (view as unknown as HTMLElement).focus?.();
}
