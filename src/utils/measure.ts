import type { HostInstance } from 'react-native';

/** Where the top edge of `view` is on screen, in points from the top of the window. */
export function measureTopInWindow(view: HostInstance): Promise<number> {
  return new Promise((resolve) => view.measureInWindow((_x, y) => resolve(y)));
}

export type WindowRect = { x: number; y: number; width: number; height: number };

/** Where `view` is on screen, in points from the top left of the window. */
export function measureInWindow(view: HostInstance): Promise<WindowRect> {
  return new Promise((resolve) => view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));
}
