import { AccessibilityInfo, type HostInstance } from 'react-native';

import { moveAccessibilityFocus } from '@/utils/accessibility-focus';

test('sends the screen reader a focus event for the view', () => {
  const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const view = {} as HostInstance;
  moveAccessibilityFocus(view);
  expect(send).toHaveBeenCalledWith(view, 'focus');
  send.mockRestore();
});
