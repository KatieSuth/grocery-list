import { StyleSheet, View } from 'react-native';

import { SortChoices } from '@/components/sort-choices';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ItemSort, SortDirection } from '@/domain/item-sort';
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
      <SortChoices
        sort={sort}
        direction={direction}
        onChangeSort={onChangeSort}
        onChangeDirection={onChangeDirection}
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
