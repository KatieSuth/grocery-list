import { HeaderHeightContext } from 'expo-router/react-navigation';
import { use, type ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import Animated, { type AnimatedRef } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  children: ReactNode;
  /** Pinned to the bottom of the screen, above the home indicator. */
  footer?: ReactNode;
  /** Lets children (e.g. drag-to-reorder lists) scroll this screen. */
  scrollRef?: AnimatedRef<Animated.ScrollView>;
  testID?: string;
};

/** Scrollable content area with an optional fixed footer of actions. */
export function Screen({ children, footer, scrollRef, testID }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  // 0 when the screen has no navigation header above it.
  const headerHeight = use(HeaderHeightContext) ?? 0;
  return (
    <ThemedView style={styles.flex} testID={testID}>
      {/* `padding` on both platforms: Android apps are edge-to-edge, so the window no longer
          resizes for the keyboard, and without a behavior the keyboard covers the inputs. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          {children}
        </Animated.ScrollView>
        {footer ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, Spacing.three), borderColor: theme.border },
            ]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
