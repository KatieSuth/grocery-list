import type { Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type HostInstance,
} from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle?: string;
  /** A smaller line under the title, e.g. a store's departments. */
  detail: string;
  /** The detail as screen readers should say it (the shown text may read badly, e.g. "→"). */
  spokenDetail: string;
  /** Limits the detail to this many lines. */
  detailNumberOfLines?: number;
  onPress?: () => void;
  /** E.g. to show more options for the row. */
  onLongPress?: () => void;
  accessibilityHint?: string;
  /** Extra actions screen readers offer (e.g. TalkBack's actions menu), handled by onAccessibilityAction. */
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  ref?: Ref<HostInstance>;
};

/**
 * A tappable summary row used for stores and items in lists. Screen readers read its label
 * instead of the text inside, so the label carries everything shown: title, subtitle and detail.
 */
export function Card({
  title,
  subtitle,
  detail,
  spokenDetail,
  detailNumberOfLines,
  onPress,
  onLongPress,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
  ref,
}: Props) {
  const theme = useTheme();
  const label = `${subtitle ? `${title}, ${subtitle}` : title}. ${spokenDetail}.`;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, opacity: pressOpacity(pressed) },
      ]}>
      <View style={styles.text}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={detailNumberOfLines}>
          {detail}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary" accessibilityElementsHidden importantForAccessibility="no">
        ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  text: { flex: 1, gap: Spacing.half },
  title: { fontWeight: 600 },
});
