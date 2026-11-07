import { TextInput, type HostInstance } from 'react-native';

/** The text field that has focus (so the keyboard is up), if any. */
export function focusedTextInput(): HostInstance | null {
  return TextInput.State.currentlyFocusedInput() ?? null;
}
