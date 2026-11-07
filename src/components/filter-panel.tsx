import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { toggleKey, type FilterOption, type FilterOptions, type ItemFilter } from '@/domain/item-filter';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  options: FilterOptions;
  filter: ItemFilter;
  onChange: (filter: ItemFilter) => void;
};

/** Store, department and brand options for narrowing the master list. */
export function FilterPanel({ options, filter, onChange }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
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

function FilterGroup({ title, empty, options, selected, onToggle }: GroupProps) {
  const theme = useTheme();
  return (
    <View style={styles.group} accessibilityLabel={`Filter by ${title.toLowerCase()}`}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {options.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      ) : (
        <View style={styles.chips}>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
  },
});
