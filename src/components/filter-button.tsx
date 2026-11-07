import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Number of active filters; shown as a badge. */
  count: number;
  expanded: boolean;
  onPress: () => void;
};

/** The filter icon next to the search box. */
export function FilterButton({ count, expanded, onPress }: Props) {
  const theme = useTheme();
  const active = count > 0;
  const color = active || expanded ? theme.tint : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? `Filters, ${count} on` : 'Filters'}
      aria-expanded={expanded}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: expanded ? theme.tint : theme.border,
          opacity: pressOpacity(pressed),
        },
      ]}>
      <SymbolView
        name={{
          ios: active ? 'line.3.horizontal.decrease.circle.fill' : 'line.3.horizontal.decrease.circle',
          android: 'filter_list',
          web: 'filter_list',
        }}
        tintColor={color}
        size={24}
      />
      {active ? (
        <View style={[styles.badge, { backgroundColor: theme.tint }]}>
          <ThemedText style={[styles.badgeText, { color: theme.onTint }]}>{count}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: 700 },
});
