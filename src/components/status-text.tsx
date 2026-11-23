import { ThemedText } from '@/components/themed-text';
import { useAnnouncement } from '@/hooks/use-announcement';

/**
 * A short note about something that just happened ("Trip finished: 2 items logged as bought."),
 * read aloud by screen readers when it appears or changes, on every platform.
 */
export function StatusText({ message }: { message: string }) {
  useAnnouncement(message);
  return (
    <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
      {message}
    </ThemedText>
  );
}
