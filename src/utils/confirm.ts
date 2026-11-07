import { Alert } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  onConfirm: () => void;
};

/** Asks before an action, with a cancel button and a confirm button. */
export function confirmAction(options: ConfirmOptions): void {
  showConfirm(options, 'default');
}

/** Asks before a destructive action; the confirm button is styled as destructive on iOS. */
export function confirmDestructive(options: ConfirmOptions): void {
  showConfirm(options, 'destructive');
}

function showConfirm(
  { title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm }: ConfirmOptions,
  style: 'default' | 'destructive',
): void {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style, onPress: onConfirm },
  ]);
}
