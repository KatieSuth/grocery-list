import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { BusyOverlay } from '@/components/busy-overlay';

afterEach(() => jest.restoreAllMocks());

test('says what is happening, aloud too, and ignores Back', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  await render(<BusyOverlay message="Copying store…" />);
  // Not at once, so a quick save doesn't flash it.
  expect(screen.queryByText('Copying store…')).toBeNull();
  const overlay = await screen.findByLabelText('Copying store… Please keep the app open until this finishes.');
  expect(overlay).toHaveProp('accessibilityRole', 'progressbar');
  expect(overlay).toBeBusy();
  expect(screen.getByText('Copying store…')).toBeOnTheScreen();
  if (Platform.OS === 'ios') expect(announce).toHaveBeenCalledWith('Copying store…');

  // Android's Back button reaches the overlay, which stays put.
  let modal = overlay;
  while (modal.type !== 'Modal' && modal.parent) modal = modal.parent;
  expect(modal.type).toBe('Modal');
  await fireEvent(modal, 'requestClose');
  expect(screen.getByText('Copying store…')).toBeOnTheScreen();
});
