import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';

import { CheckboxBox } from '@/components/checkbox-box';
import { ErrorText, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { sortDepartmentsByName } from '@/domain/departments';
import { MAX_NAME_LENGTH } from '@/domain/names';
import type { Store } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export type AddDepartmentOutcome = { ok: true; note: string } | { ok: false; error: string };

type Props = {
  stores: Store[];
  /** Selected store id -> chosen department id (or null if not chosen yet). */
  selections: Record<string, string | null>;
  onToggleStore: (storeId: string) => void;
  onChooseDepartment: (storeId: string, departmentId: string) => void;
  /**
   * Adds a department to the store, so the user needn't leave the form when it's missing.
   * Resolves to an error, or to a note saying what happened once the department is chosen.
   */
  onAddDepartment: (storeId: string, name: string) => Promise<AddDepartmentOutcome>;
  storesError?: string;
  departmentErrors?: Record<string, string>;
};

/**
 * Pick which stores carry an item, and the department it's in at each one.
 *
 * Choosing closes the keyboard: the user is done typing the name, and the keyboard would
 * otherwise cover the departments that appear.
 *
 * A department that's missing can be added right here, without leaving the form (which would
 * mean saving or discarding the item first).
 */
export function StoreLocationPicker({
  stores,
  selections,
  onToggleStore,
  onChooseDepartment,
  onAddDepartment,
  storesError,
  departmentErrors = {},
}: Props) {
  const theme = useTheme();
  /** The store a department is being added to, if any; one at a time. */
  const [addingTo, setAddingTo] = useState<string>();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string>();
  const [adding, setAdding] = useState(false);
  /** Said after adding, for one store: e.g. where the new department went. */
  const [addedNote, setAddedNote] = useState<{ storeId: string; message: string }>();

  const startAdding = (storeId: string) => {
    setAddingTo(storeId);
    setNewName('');
    setAddError(undefined);
    setAddedNote(undefined);
  };

  const add = async (store: Store) => {
    setAdding(true);
    const outcome = await onAddDepartment(store.id, newName);
    setAdding(false);
    if (!outcome.ok) {
      setAddError(outcome.error);
      return;
    }
    setAddingTo(undefined);
    setAddedNote({ storeId: store.id, message: outcome.note });
  };

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
              onPress={() => {
                Keyboard.dismiss();
                onToggleStore(store.id);
              }}
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
                      onPress={() => {
                        Keyboard.dismiss();
                        onChooseDepartment(store.id, dept.id);
                      }}
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
                {addingTo === store.id ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add a department to ${store.name}`}
                    onPress={() => startAdding(store.id)}
                    style={[styles.chip, styles.addChip, { borderColor: theme.border }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      + New department
                    </ThemedText>
                  </Pressable>
                )}
                {addingTo === store.id ? (
                  <View style={[styles.fullWidth, styles.addForm]}>
                    <TextField
                      label="New department"
                      accessibilityLabel={`New department at ${store.name}`}
                      placeholder="e.g. Bakery"
                      value={newName}
                      onChangeText={(text) => {
                        setNewName(text);
                        setAddError(undefined);
                      }}
                      onSubmitEditing={() => void add(store)}
                      returnKeyType="done"
                      submitBehavior="submit"
                      autoFocus
                      error={addError}
                      maxLength={MAX_NAME_LENGTH}
                    />
                    <View style={styles.addButtons}>
                      <Button
                        compact
                        variant="ghost"
                        label="Cancel"
                        accessibilityLabel="Cancel adding a department"
                        onPress={() => setAddingTo(undefined)}
                      />
                      <Button
                        compact
                        variant="secondary"
                        label="Add"
                        accessibilityLabel={`Add department to ${store.name}`}
                        disabled={adding}
                        onPress={() => void add(store)}
                      />
                    </View>
                  </View>
                ) : null}
                {addedNote?.storeId === store.id ? (
                  <View style={styles.fullWidth}>
                    <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
                      {addedNote.message}
                    </ThemedText>
                  </View>
                ) : null}
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
  addChip: { borderStyle: 'dashed' },
  addForm: { gap: Spacing.two },
  addButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
