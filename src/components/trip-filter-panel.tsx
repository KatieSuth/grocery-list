import { StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { DateField } from '@/components/date-field';
import { FilterGroup } from '@/components/filter-group';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { toggleKey, type FilterOption } from '@/domain/item-filter';
import {
  PRESET_LABELS,
  RANGE_PRESETS,
  rangeDays,
  startOfDay,
  type RangePreset,
  type TripFilter,
} from '@/domain/trip-history';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  storeOptions: FilterOption[];
  tagOptions: FilterOption[];
  filter: TripFilter;
  onChange: (filter: TripFilter) => void;
  now: number;
};

type RangeChoice = RangePreset | 'custom';

const RANGE_CHOICES: { value: RangeChoice; label: string; spoken: string }[] = [
  ...RANGE_PRESETS.map((value) => ({ value, label: PRESET_LABELS[value], spoken: PRESET_LABELS[value] })),
  { value: 'custom', label: 'Custom', spoken: 'Custom dates' },
];

/**
 * Which trips to show: finished within a date range (a preset, or custom From and To days, never
 * after today), at which stores, and with items that had which tags when they were bought.
 */
export function TripFilterPanel({ storeOptions, tagOptions, filter, onChange, now }: Props) {
  const theme = useTheme();
  const today = startOfDay(now);
  const { from, to } = rangeDays(filter.range, now);

  const chooseRange = (choice: RangeChoice) =>
    // Custom starts from the days shown so far, ready to adjust.
    onChange({ ...filter, range: choice === 'custom' ? { preset: 'custom', from, to } : { preset: choice } });

  return (
    <View testID="trip-filter-panel" style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
      <ChoiceChips title="Dates" choices={RANGE_CHOICES} selected={filter.range.preset} onChange={chooseRange} />
      {filter.range.preset === 'custom' ? (
        <View style={styles.custom}>
          <ThemedText type="small" themeColor="textSecondary">
            Trips from the From day through the To day. The To day can&apos;t be after today.
          </ThemedText>
          <View style={styles.days}>
            <DateField
              label="From"
              value={from}
              max={to}
              onChange={(day) => onChange({ ...filter, range: { preset: 'custom', from: day, to } })}
            />
            <DateField
              label="To"
              value={to}
              min={from}
              max={today}
              onChange={(day) => onChange({ ...filter, range: { preset: 'custom', from, to: day } })}
            />
          </View>
        </View>
      ) : null}
      <FilterGroup
        title="Stores"
        empty="No trips logged yet."
        options={storeOptions}
        selected={filter.storeIds}
        onToggle={(key) => onChange({ ...filter, storeIds: toggleKey(filter.storeIds, key) })}
      />
      <FilterGroup
        title="Tags"
        empty="No trips with tagged items yet."
        options={tagOptions}
        selected={filter.tags}
        onToggle={(key) => onChange({ ...filter, tags: toggleKey(filter.tags, key) })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 12, padding: Spacing.three, gap: Spacing.three },
  custom: { gap: Spacing.two },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
