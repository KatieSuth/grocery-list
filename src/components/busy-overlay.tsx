import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAnnouncement } from '@/hooks/use-announcement';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** What's happening, e.g. "Copying store…". Shown and read aloud. */
  message: string;
};

/** How long to wait before appearing, so a save that's over in a moment doesn't flash it. */
const DELAY_MS = 300;

const KEEP_OPEN = 'Please keep the app open until this finishes.';

/**
 * Covers the screen with a spinner while something that must not be interrupted is being saved,
 * e.g. copying a store with its items. Nothing behind it can be tapped, and Android's Back
 * button does nothing until it's gone. Whatever is shown under it must already be blocked from
 * being left (see useUnsavedChangesWarning's `busy`), since it only appears after a moment.
 */
export function BusyOverlay({ message }: Props) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return shown ? <Overlay message={message} /> : null;
}

function Overlay({ message }: { message: string }) {
  const theme = useTheme();
  useAnnouncement(message);
  return (
    // Back is ignored: the save carries on, and the overlay goes away when it's done.
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.fill}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${message} ${KEEP_OPEN}`}
          accessibilityState={{ busy: true }}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
          aria-modal
          style={[styles.card, { backgroundColor: theme.background, borderColor: theme.controlBorder }]}>
          <ActivityIndicator size="large" color={theme.tint} />
          <ThemedText style={styles.message}>{message}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
            {KEEP_OPEN}
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  card: {
    alignItems: 'center',
    gap: Spacing.three,
    maxWidth: 320,
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
  },
  message: { textAlign: 'center' },
});
