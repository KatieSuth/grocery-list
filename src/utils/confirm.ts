import { Alert } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
};

/** Asks before a destructive action, with Cancel and a destructive confirm button. */
export function confirmDestructive({ title, message, confirmLabel, onConfirm }: ConfirmOptions): void {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
