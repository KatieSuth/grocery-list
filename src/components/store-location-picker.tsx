import { Pressable, StyleSheet, View } from 'react-native';

import { CheckboxBox } from '@/components/checkbox-box';
import { ErrorText } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { sortDepartmentsByName } from '@/domain/departments';
import type { Store } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  stores: Store[];
  /** Selected store id -> chosen department id (or null if not chosen yet). */
  selections: Record<string, string | null>;
  onToggleStore: (storeId: string) => void;
  onChooseDepartment: (storeId: string, departmentId: string) => void;
  storesError?: string;
  departmentErrors?: Record<string, string>;
};

/** Pick which stores carry an item, and the department it's in at each one. */
export function StoreLocationPicker({
  stores,
  selections,
  onToggleStore,
  onChooseDepartment,
  storesError,
  departmentErrors = {},
}: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="smallBold">Where to find it</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Pick each store that carries it, then the department.
        </ThemedText>
      </View>

      {stores.map((store) => {
        const selected = store.id in selections;
        return (
          <View
            key={store.id}
            style={[
              styles.store,
              { borderColor: selected ? theme.tint : theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <Pressable
              accessibilityRole="checkbox"
              aria-checked={selected}
              accessibilityLabel={store.location ? `${store.name}, ${store.location}` : store.name}
              onPress={() => onToggleStore(store.id)}
              style={styles.storeHeader}>
              <CheckboxBox checked={selected} />
              <View style={styles.flex}>
                <ThemedText style={styles.storeName}>{store.name}</ThemedText>
                {store.location ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {store.location}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>

            {selected ? (
              <View style={styles.departments} accessibilityRole="radiogroup" accessibilityLabel={`Department in ${store.name}`}>
                {/* A–Z is easiest to scan here; the store's walking order is for the shopping trip. */}
                {sortDepartmentsByName(store.departments).map((dept) => {
                  const chosen = selections[store.id] === dept.id;
                  return (
                    <Pressable
                      key={dept.id}
                      accessibilityRole="radio"
                      aria-checked={chosen}
                      accessibilityLabel={`${dept.name} in ${store.name}`}
                      onPress={() => onChooseDepartment(store.id, dept.id)}
                      style={[
                        styles.chip,
                        { borderColor: chosen ? theme.tint : theme.border },
                        chosen && { backgroundColor: theme.tint },
                      ]}>
                      <ThemedText type="small" style={chosen ? { color: theme.onTint } : undefined}>
                        {dept.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
                {departmentErrors[store.id] ? (
                  <View style={styles.fullWidth}>
                    <ErrorText message={departmentErrors[store.id]} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
      {storesError ? <ErrorText message={storesError} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  header: { gap: Spacing.half, marginBottom: Spacing.one },
  store: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    minHeight: 48,
  },
  flex: { flex: 1 },
  storeName: { fontWeight: 600 },
  departments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
  },
  fullWidth: { width: '100%' },
});
