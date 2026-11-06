import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle?: string;
  detail?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** A tappable summary row used for stores and items in lists. */
export function Card({ title, subtitle, detail, onPress, accessibilityHint }: Props) {
  const theme = useTheme();
  const label = subtitle ? `${title}, ${subtitle}` : title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
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
        {detail}
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
