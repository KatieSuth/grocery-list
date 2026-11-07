import type { ConfirmOptions } from './confirm';

/**
 * Web version: React Native Web's Alert.alert does nothing, so use the browser's dialog. Its
 * buttons are always OK and Cancel, so custom button labels can't be shown.
 */
export function confirmAction({ title, message, onConfirm }: ConfirmOptions): void {
  if (window.confirm(message ? `${title}\n\n${message}` : title)) {
    onConfirm();
  }
}

export const confirmDestructive = confirmAction;
