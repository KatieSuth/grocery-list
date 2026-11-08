import { use, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import type Animated from 'react-native-reanimated';
import type { AnimatedRef } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpaceBelowFocusedFieldContext } from '@/components/space-below-focused-field';
import { TabBarClearsSystemBarContext } from '@/components/tab-bar-clears-system-bar';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { focusedTextInput } from '@/utils/focused-input';
import { measureTopInWindow } from '@/utils/measure';
import { setRef } from '@/utils/set-ref';

type Props = {
  children: ReactNode;
  /** Pinned to the bottom of the screen, above the home indicator (or the tab bar). */
  footer?: ReactNode;
  /** Lets children (e.g. drag-to-reorder lists) scroll this screen. */
  scrollRef?: AnimatedRef<Animated.ScrollView>;
  testID?: string;
};

/**
 * Scrollable content area with an optional fixed footer of actions.
 *
 * When the keyboard opens, the content scrolls up with it so the focused field stays visible
 * just above the keyboard, along with its error message if it has one. The footer stays where
 * it is, behind the keyboard.
 */
export function Screen({ children, footer, scrollRef, testID }: Props) {
  const insets = useSafeAreaInsets();
  // Below the tabs' screens, the tab bar already leaves room for the system navigation bar.
  const systemBarSpace = use(TabBarClearsSystemBarContext) ? 0 : insets.bottom;
  const theme = useTheme();
  const keyboardAwareRef = useRef<KeyboardAwareScrollViewRef | null>(null);
  const containerRef = useRef<HostInstance | null>(null);

  const setScrollView = (scrollView: KeyboardAwareScrollViewRef | null) => {
    keyboardAwareRef.current = scrollView;
    // The inner view is a Reanimated ScrollView, which is what drag-to-reorder scrolls.
    setRef(scrollRef as Parameters<typeof setRef>[0], scrollView);
  };

  // Content above a focused field can grow while typing (e.g. adding a department pushes the
  // "New department" field down); scroll again so the field doesn't slide under the keyboard.
  // If the user has scrolled past the field (it's above the screen), leave the scroll alone:
  // e.g. checking a second store on the item form while the name field still has focus.
  const keepFocusedFieldVisible = () => {
    const input = focusedTextInput();
    const container = containerRef.current;
    if (!input || !container) return;
    void Promise.all([measureTopInWindow(container), measureTopInWindow(input)]).then(([screenTop, inputTop]) => {
      if (inputTop >= screenTop) keyboardAwareRef.current?.assureFocusedInputVisible();
    });
  };

  // Room to keep above the keyboard under the focused field, e.g. for "already in the list".
  const [spaceBelowFocusedField, setSpaceBelowFocusedField] = useState(0);
  useEffect(keepFocusedFieldVisible, [spaceBelowFocusedField]);

  return (
    <ThemedView ref={containerRef} style={styles.flex} testID={testID}>
      <SpaceBelowFocusedFieldContext value={setSpaceBelowFocusedField}>
        <KeyboardAwareScrollView
          ref={setScrollView}
          onContentSizeChange={keepFocusedFieldVisible}
          bottomOffset={Spacing.three + spaceBelowFocusedField}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          {children}
        </KeyboardAwareScrollView>
      </SpaceBelowFocusedFieldContext>
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(systemBarSpace, Spacing.three), borderColor: theme.border },
          ]}>
          {footer}
        </View>
      ) : null}
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
