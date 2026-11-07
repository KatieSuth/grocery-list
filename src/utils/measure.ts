import type { HostInstance } from 'react-native';

/** Where the top edge of `view` is on screen, in points from the top of the window. */
export function measureTopInWindow(view: HostInstance): Promise<number> {
  return new Promise((resolve) => view.measureInWindow((_x, y) => resolve(y)));
}
