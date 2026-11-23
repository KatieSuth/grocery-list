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
  const sortChanged = sort !== defaultChoice.sort || direction !== defaultChoice.direction;
  const spokenSort = `by ${SORT_LABELS[sort].toLowerCase()}, ${directionSpoken(sort)[direction]}`;
  return (
    <FilterIconButton
      label={`Sort and filter, ${spokenSort}`}
      count={count}
      highlighted={sortChanged}
      expanded={expanded}
      onPress={onPress}
    />
  );
}

type IconProps = {
  /** What it's announced as, before the number of filters on ("Sort and filter, by name, A to Z"). */
  label: string;
  /** Number of active filters; shown as a badge. */
  count: number;
  /** Highlights the icon for a change the badge doesn't count, such as a non-default sort. */
  highlighted?: boolean;
  expanded: boolean;
  onPress: () => void;
};

/**
 * A filter icon button that opens a panel. It's highlighted while filters are on, `highlighted`
 * is set, or the panel is open, and announces how many filters are on.
 */
export function FilterIconButton({ label, count, highlighted = false, expanded, onPress }: IconProps) {
  const theme = useTheme();
  const active = count > 0;
  const spokenFilters = count === 1 ? ', 1 filter on' : count > 1 ? `, ${count} filters on` : '';
  const color = active || highlighted || expanded ? theme.tint : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${spokenFilters}`}
      aria-expanded={expanded}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: expanded ? theme.tint : theme.controlBorder,
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
          {/* It sits on the button's corner: let it grow with large text, but not over the icon. */}
          <ThemedText maxFontSizeMultiplier={1.5} style={[styles.badgeText, { color: theme.onTint }]}>
            {count}
          </ThemedText>
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
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: 700 },
});
