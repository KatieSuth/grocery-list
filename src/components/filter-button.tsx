import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { directionSpoken, SORT_LABELS, type ItemSort, type ItemSortChoice, type SortDirection } from '@/domain/item-sort';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Number of active filters; shown as a badge. */
  count: number;
  sort: ItemSort;
  direction: SortDirection;
  /** The default sort chosen in Settings. The icon is highlighted while the list isn't in it. */
  defaultChoice: ItemSortChoice;
  expanded: boolean;
  onPress: () => void;
};

/**
 * The sort and filter icon next to the search box. It announces the current sort and how many
 * filters are on, and is highlighted while either differs from the defaults.
 */
export function FilterButton({ count, sort, direction, defaultChoice, expanded, onPress }: Props) {
  const theme = useTheme();
  const active = count > 0;
  const sortChanged = sort !== defaultChoice.sort || direction !== defaultChoice.direction;
  const spokenSort = `by ${SORT_LABELS[sort].toLowerCase()}, ${directionSpoken(sort)[direction]}`;
  const spokenFilters = count === 1 ? ', 1 filter on' : count > 1 ? `, ${count} filters on` : '';
  const color = active || sortChanged || expanded ? theme.tint : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sort and filter, ${spokenSort}${spokenFilters}`}
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
