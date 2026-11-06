import type { ConfirmOptions } from './confirm';

/** Web version: React Native Web's Alert.alert does nothing, so use the browser's dialog. */
export function confirmDestructive({ title, message, onConfirm }: ConfirmOptions): void {
  if (window.confirm(message ? `${title}\n\n${message}` : title)) {
    onConfirm();
  }
}
