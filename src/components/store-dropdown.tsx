import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PickerSheet } from '@/components/picker-sheet';
import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Store } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  stores: Store[];
  selected?: Store;
  onChoose: (store: Store) => void;
};

/** A dropdown-style field showing the chosen store; tapping it lists the stores to pick from. */
export function StoreDropdown({ stores, selected, onChoose }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">Store</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? `Store: ${selected.name}` : 'Choose a store'}
        accessibilityHint="Opens the list of stores"
        aria-expanded={open}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressOpacity(pressed) },
        ]}>
        <View style={styles.text}>
          <ThemedText style={selected ? styles.name : { color: theme.textSecondary }}>
            {selected ? selected.name : 'Choose a store'}
          </ThemedText>
          {selected?.location ? (
            <ThemedText type="small" themeColor="textSecondary">
              {selected.location}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText themeColor="textSecondary" accessibilityElementsHidden importantForAccessibility="no">
          ▾
        </ThemedText>
      </Pressable>
      <PickerSheet
        visible={open}
        title="Which store are you at?"
        options={stores.map((store) => ({
          key: store.id,
          title: store.name,
          details: store.location ? [store.location] : [],
          accessibilityLabel: `${store.name}${store.location ? `, ${store.location}` : ''}${
            store.id === selected?.id ? ', current' : ''
          }`,
          current: store.id === selected?.id,
        }))}
        onChoose={(id) => {
          setOpen(false);
          onChoose(stores.find((s) => s.id === id) as Store);
        }}
        onCancel={() => setOpen(false)}
        cancelAccessibilityLabel="Cancel choosing a store"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 10,
  },
  text: { flex: 1, gap: Spacing.half },
  name: { fontWeight: 600 },
});
