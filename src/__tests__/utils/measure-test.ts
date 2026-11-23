import type { HostInstance } from 'react-native';

import { measureInWindow, measureTopInWindow } from '@/utils/measure';

test('measureTopInWindow resolves with the top edge of the view on screen', async () => {
  const view = {
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
      callback(10, 120, 300, 48),
  } as unknown as HostInstance;
  await expect(measureTopInWindow(view)).resolves.toBe(120);
});

test('measureInWindow resolves with where the view is on screen', async () => {
  const view = {
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
      callback(10, 120, 300, 48),
  } as unknown as HostInstance;
  await expect(measureInWindow(view)).resolves.toEqual({ x: 10, y: 120, width: 300, height: 48 });
});
