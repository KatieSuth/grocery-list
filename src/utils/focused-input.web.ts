import type { HostInstance } from 'react-native';

/**
 * Web: browsers keep a focused field visible above the on-screen keyboard themselves, so
 * screens never need to scroll it back into view. (React Native Web's TextInput.State also
 * lacks `currentlyFocusedInput`.)
 */
export function focusedTextInput(): HostInstance | null {
  return null;
}
