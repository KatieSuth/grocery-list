import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { ChipHitSlop, Spacing } from '@/constants/theme';
import type { FilterOption } from '@/domain/item-filter';
import { useTheme } from '@/hooks/use-theme';

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
export function FilterGroup({ title, empty, options, selected, onToggle }: GroupProps) {
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
                hitSlop={ChipHitSlop}
                style={[
                  styles.chip,
                  { borderColor: on ? theme.tint : theme.controlBorder, backgroundColor: on ? theme.tint : theme.background },
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
