import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CheckboxBox } from '@/components/checkbox-box';
import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { QUANTITY_MAX_LENGTH } from '@/domain/quantity';
import type { Item, ListEntry } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  item: Item;
  /** "Store · Department" text for where to find the item. */
  whereToFind: string;
  /** Present when the item is checked. */
  entry?: ListEntry;
  onToggle: () => void;
  onQuantityChange: (quantity: string) => void;
  onOpen: () => void;
};

/** A master-list row: checkbox, item summary (tap to edit), and a quantity field while checked. */
export function MasterItemRow({ item, whereToFind, entry, onToggle, onQuantityChange, onOpen }: Props) {
  const theme = useTheme();
  const checked = !!entry;
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={checked}
        accessibilityLabel={item.name}
        onPress={onToggle}
        hitSlop={12}
        style={styles.checkbox}>
        <CheckboxBox checked={checked} />
      </Pressable>

      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.brand ? `${item.name}, ${item.brand}` : item.name}
          accessibilityHint="Edit this item"
          onPress={onOpen}
          style={({ pressed }) => [styles.summary, { opacity: pressOpacity(pressed) }]}>
          <View style={styles.text}>
            <ThemedText style={styles.name}>{item.name}</ThemedText>
            {item.brand ? (
              <ThemedText type="small" themeColor="textSecondary">
                {item.brand}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {whereToFind || 'No store selected'}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" accessibilityElementsHidden importantForAccessibility="no">
            ›
          </ThemedText>
        </Pressable>

        {entry ? (
          // Keyed by checkedAt so re-checking always starts from the saved (blank) value.
          <QuantityInput
            key={entry.checkedAt}
            itemName={item.name}
            initial={entry.quantity ?? ''}
            onChange={onQuantityChange}
          />
        ) : null}
      </View>
    </View>
  );
}

function QuantityInput({
  itemName,
  initial,
  onChange,
}: {
  itemName: string;
  initial: string;
  onChange: (quantity: string) => void;
}) {
  const theme = useTheme();
  // Local state keeps typing smooth; every change is also saved.
  const [value, setValue] = useState(initial);
  return (
    <TextInput
      accessibilityLabel={`Quantity for ${itemName}`}
      placeholder="Quantity (optional), e.g. 4 or 1/2 lb"
      placeholderTextColor={theme.textSecondary}
      value={value}
      maxLength={QUANTITY_MAX_LENGTH}
      returnKeyType="done"
      onChangeText={(text) => {
        setValue(text);
        onChange(text);
      }}
      style={[styles.quantity, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    paddingVertical: Spacing.two,
  },
  checkbox: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  body: { flex: 1, gap: Spacing.two, paddingRight: Spacing.three },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingVertical: Spacing.one,
  },
  text: { flex: 1, gap: Spacing.half },
  name: { fontWeight: 600 },
  quantity: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.one,
    fontSize: 15,
  },
});
