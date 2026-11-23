import type { HostInstance } from 'react-native';

import { moveAccessibilityFocus } from '@/utils/accessibility-focus';

test('focuses the element on the web', () => {
  const button = document.createElement('button');
  document.body.append(button);
  moveAccessibilityFocus(button as unknown as HostInstance);
  expect(document.activeElement).toBe(button);
  button.remove();
});
