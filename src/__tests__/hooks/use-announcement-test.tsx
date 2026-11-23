import { renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { useAnnouncement } from '@/hooks/use-announcement';

afterEach(() => jest.restoreAllMocks());

test('a message is announced when it appears or changes, on iOS only (Android reads live regions)', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const { rerender } = await renderHook(({ message }: { message?: string }) => useAnnouncement(message), {
    initialProps: { message: undefined },
  });
  await rerender({ message: 'Saved “Milk”.' });
  await rerender({ message: 'Saved “Milk”.' });
  await rerender({ message: '' });
  await rerender({ message: 'Saved “Bread”.' });

  // Nothing for no message or a blank one, and an unchanged message isn't repeated.
  expect(announce.mock.calls).toEqual(Platform.OS === 'ios' ? [['Saved “Milk”.'], ['Saved “Bread”.']] : []);
});
