import { StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  directionLabels,
  directionSpoken,
  ITEM_SORTS,
  SORT_LABELS,
  type ItemSort,
  type SortDirection,
} from '@/domain/item-sort';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  sort: ItemSort;
  direction: SortDirection;
  onChangeSort: (sort: ItemSort) => void;
  onChangeDirection: (direction: SortDirection) => void;
};

/** Choose what the master list is ordered by, and which way (A–Z or Z–A, newest or oldest first). */
export function SortPanel({ sort, direction, onChangeSort, onChangeDirection }: Props) {
  return (
    <View style={[styles.panel, { backgroundColor: useTheme().backgroundElement }]}>
      <ChoiceChips
        title="Sort by"
        choices={ITEM_SORTS.map((value) => ({
          value,
          label: SORT_LABELS[value],
          spoken: `Sort by ${SORT_LABELS[value].toLowerCase()}`,
        }))}
        selected={sort}
        onChange={onChangeSort}
      />
      <ChoiceChips
        title="Order"
        choices={(['asc', 'desc'] as const).map((value) => ({
          value,
          label: directionLabels(sort)[value],
          spoken: directionSpoken(sort)[value],
        }))}
        selected={direction}
        onChange={onChangeDirection}
      />
      {sort === 'department' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Items in more than one department are listed under each. Checking one checks them all.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 12, padding: Spacing.three, gap: Spacing.three },
});
