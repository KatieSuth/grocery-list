import { Alert } from 'react-native';

/** Shows a message with an OK button. */
export function notify(title: string, message: string): void {
  Alert.alert(title, message);
}
