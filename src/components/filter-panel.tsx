import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { pressOpacity } from '@/components/press-feedback';
import { SortChoices } from '@/components/sort-choices';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  toggleKey,
  type CheckedFilter,
  type FilterOption,
  type FilterOptions,
  type ItemFilter,
} from '@/domain/item-filter';
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
 * How the master list is sorted, then the checked state, store, department and brand options for
 * narrowing it. The store, department and brand groups can be collapsed.
 */
export function FilterPanel({ options, filter, onChange, sort, direction, onChangeSort, onChangeDirection }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
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
    </View>
  );
}

type GroupProps = {
  title: string;
  empty: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (key: string) => void;
};

/**
 * A collapsible group of options. It starts collapsed unless something in it is picked, so
 * reopening the panel shows the current picks.
 */
function FilterGroup({ title, empty, options, selected, onToggle }: GroupProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(selected.length > 0);
  const count = selected.length;
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `${title}, ${count} on` : title}
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [styles.header, { opacity: pressOpacity(pressed) }]}>
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
        {count > 0 ? (
          <ThemedText type="small" style={{ color: theme.tint }}>
            {count} on
          </ThemedText>
        ) : null}
        <SymbolView
          name={{
            ios: expanded ? 'chevron.up' : 'chevron.down',
            android: expanded ? 'expand_less' : 'expand_more',
            web: expanded ? 'expand_less' : 'expand_more',
          }}
          tintColor={theme.text}
          size={20}
        />
      </Pressable>
      {!expanded ? null : options.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      ) : (
        <View style={styles.chips} accessibilityLabel={`Filter by ${title.toLowerCase()}`}>
          {options.map((option) => {
            const on = selected.includes(option.key);
            return (
              <Pressable
                key={option.key}
                accessibilityRole="checkbox"
                aria-checked={on}
                accessibilityLabel={`${title}: ${option.label}`}
                onPress={() => onToggle(option.key)}
                style={[
                  styles.chip,
                  { borderColor: on ? theme.tint : theme.border, backgroundColor: on ? theme.tint : theme.background },
                ]}>
                <ThemedText type="small" style={{ color: on ? theme.onTint : theme.text }}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 12, padding: Spacing.three, gap: Spacing.three },
  group: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  title: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
  },
});
