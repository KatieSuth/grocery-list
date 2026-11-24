import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useFocusAfterRemove } from '@/hooks/use-focus-after-remove';

afterEach(() => jest.restoreAllMocks());

test('does nothing when there is nowhere to move to (no field shown)', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const { result } = await renderHook(() => useFocusAfterRemove());
  await act(async () => result.current.removed(['a'], 0));
  expect(focus).not.toHaveBeenCalled();
});
