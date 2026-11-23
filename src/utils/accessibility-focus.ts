import { AccessibilityInfo, type HostInstance } from 'react-native';

/** Moves the screen reader (TalkBack, VoiceOver) to `view`. */
export function moveAccessibilityFocus(view: HostInstance): void {
  AccessibilityInfo.sendAccessibilityEvent(view, 'focus');
}
