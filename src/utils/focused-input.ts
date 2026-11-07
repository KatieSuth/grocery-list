import { TextInput } from 'react-native';

/** Whether a text field has focus (and so the keyboard is up). */
export function isTextInputFocused(): boolean {
  return TextInput.State.currentlyFocusedInput() != null;
}
