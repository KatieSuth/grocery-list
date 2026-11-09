/** Web version: React Native Web's Alert.alert does nothing, so use the browser's dialog. */
export function notify(title: string, message: string): void {
  window.alert(`${title}\n\n${message}`);
}
