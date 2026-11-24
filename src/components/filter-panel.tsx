import { StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { FilterGroup } from '@/components/filter-group';
import { SortChoices } from '@/components/sort-choices';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { toggleKey, type CheckedFilter, type FilterOptions, type ItemFilter } from '@/domain/item-filter';
import type { ItemSort, SortDirection } from '@/domain/item-sort';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  options: FilterOptions;
  filter: ItemFilter;
  onChange: (filter: ItemFilter) => void;
  sort: ItemSort;
  direction: SortDirection;
  onChangeSort: (sort: ItemSort) => void;
  onChangeDirection: (direction: SortDirection) => void;
};

const CHECKED_CHOICES: { value: CheckedFilter; label: string; spoken: string }[] = [
  { value: 'all', label: 'All', spoken: 'All items' },
  { value: 'checked', label: 'Checked', spoken: 'Checked items only' },
  { value: 'unchecked', label: 'Unchecked', spoken: 'Unchecked items only' },
];

/**
 * How the master list is sorted, then the checked state, store, department, brand and tag options
 * for narrowing it. Those groups can be collapsed.
 */
export function FilterPanel({ options, filter, onChange, sort, direction, onChangeSort, onChangeDirection }: Props) {
  const theme = useTheme();
  return (
    <View testID="filter-panel" style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
      <SortChoices sort={sort} direction={direction} onChangeSort={onChangeSort} onChangeDirection={onChangeDirection} />
      {sort === 'department' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Items in more than one department are listed under each. Checking one checks them all.
        </ThemedText>
      ) : null}
      <ChoiceChips
        title="Show"
        choices={CHECKED_CHOICES}
        selected={filter.checked}
        onChange={(checked) => onChange({ ...filter, checked })}
      />
      <FilterGroup
        title="Stores"
        empty="No stores yet."
        options={options.stores}
        selected={filter.storeIds}
        onToggle={(key) => onChange({ ...filter, storeIds: toggleKey(filter.storeIds, key) })}
      />
      <FilterGroup
        title="Departments"
        empty="No departments yet."
        options={options.departments}
        selected={filter.departments}
        onToggle={(key) => onChange({ ...filter, departments: toggleKey(filter.departments, key) })}
      />
      <FilterGroup
        title="Brands"
        empty="No items have a brand yet."
        options={options.brands}
        selected={filter.brands}
        onToggle={(key) => onChange({ ...filter, brands: toggleKey(filter.brands, key) })}
      />
      <FilterGroup
        title="Tags"
        empty="No items have tags yet."
        options={options.tags}
        selected={filter.tags}
        onToggle={(key) => onChange({ ...filter, tags: toggleKey(filter.tags, key) })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 12, padding: Spacing.three, gap: Spacing.three },
});
