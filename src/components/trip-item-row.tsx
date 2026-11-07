import { Pressable, StyleSheet, View } from 'react-native';

import { CheckboxBox } from '@/components/checkbox-box';
import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TripRow } from '@/domain/trip';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  row: TripRow;
  onToggle: () => void;
};

/** An item to get on the trip. The whole row checks it off (into the cart) or back. */
export function TripItemRow({ row: { item, entry, inCart }, onToggle }: Props) {
  const theme = useTheme();
  const details = [item.brand, entry.quantity].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={inCart}
      accessibilityLabel={[item.name, item.brand, entry.quantity].filter(Boolean).join(', ')}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: pressOpacity(pressed) * (inCart ? 0.6 : 1) },
      ]}>
      <CheckboxBox checked={inCart} />
      <View style={styles.text}>
        <ThemedText style={[styles.name, inCart && styles.done]}>{item.name}</ThemedText>
        {details ? (
          <ThemedText type="small" themeColor="textSecondary" style={inCart && styles.done}>
            {details}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  text: { flex: 1, gap: Spacing.half },
  name: { fontWeight: 600 },
  done: { textDecorationLine: 'line-through' },
});
