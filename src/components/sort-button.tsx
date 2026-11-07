import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import {
  DEFAULT_DIRECTION,
  DEFAULT_SORT,
  directionSpoken,
  SORT_LABELS,
  type ItemSort,
  type SortDirection,
} from '@/domain/item-sort';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  sort: ItemSort;
  direction: SortDirection;
  expanded: boolean;
  onPress: () => void;
};

/** The sort icon next to the filter button. Tinted when the list isn't in the default order. */
export function SortButton({ sort, direction, expanded, onPress }: Props) {
  const theme = useTheme();
  const changed = sort !== DEFAULT_SORT || direction !== DEFAULT_DIRECTION;
  const color = changed || expanded ? theme.tint : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sort, by ${SORT_LABELS[sort].toLowerCase()}, ${directionSpoken(sort)[direction]}`}
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
        name={{ ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' }}
        tintColor={color}
        size={22}
      />
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
});
