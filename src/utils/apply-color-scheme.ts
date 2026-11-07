import { Appearance } from 'react-native';

import type { ColorSchemeChoice } from '@/domain/appearance';

/**
 * Applies the choice to native UI the app doesn't draw itself: the tab bar, alerts, the keyboard
 * and the status bar. 'unspecified' goes back to following the device.
 */
export function applyColorScheme(choice: ColorSchemeChoice): void {
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
}
