import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Has VoiceOver read `message` aloud when it appears or changes, e.g. "Trip finished" or an error.
 * Messages are also marked as live regions (accessibilityLiveRegion), but only Android and the web
 * read those; iOS needs to be told. Android isn't told as well, or it would say everything twice.
 */
export function useAnnouncement(message: string | undefined): void {
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}
