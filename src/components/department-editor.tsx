import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Sortable, { type SortableGridProps } from 'react-native-sortables';

import { Button } from '@/components/button';
import { CopyDepartmentsPrompt } from '@/components/copy-departments-prompt';
import { pressOpacity } from '@/components/press-feedback';
import { ErrorText, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  addDepartment,
  copyDepartments,
  moveDepartment,
  removeDepartment,
  suggestDepartments,
} from '@/domain/departments';
import type { Department, Store } from '@/domain/types';
import { normalizeText, sameName } from '@/utils/text';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  departments: Department[];
  onChange: (departments: Department[]) => void;
  error?: string;
  /** Saved stores, whose departments are offered as suggestions while typing a new one. */
  knownStores: Store[];
  /** The store being edited, if it's already saved; it isn't offered as a store to copy from. */
  currentStoreId?: string;
  /** The scroll view around the editor, so dragging near its edge scrolls it. */
  scrollableRef?: SortableGridProps<Department>['scrollableRef'];
};

/** Ordered department list: reorder, remove, and add departments (with suggestions from other stores). */
export function DepartmentEditor({
  departments,
  onChange,
  error,
  knownStores,
  currentStoreId,
  scrollableRef,
}: Props) {
  const theme = useTheme();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string>();
  const [choosingCopySource, setChoosingCopySource] = useState(false);
  const [copyNote, setCopyNote] = useState<string>();

  const copySources = knownStores.filter((s) => s.id !== currentStoreId && s.departments.length > 0);

  const handleCopyFrom = (source: Store) => {
    setChoosingCopySource(false);
    const result = copyDepartments(departments, source.departments);
    if (result.added.length > 0) onChange(result.departments);
    setCopyNote(
      result.added.length === 0
        ? `Every department at ${source.name} is already in this list.`
        : `Copied ${result.added.length === 1 ? '1 department' : `${result.added.length} departments`} from ${source.name}: ${result.added.join(', ')}.`,
    );
  };

  const suggestions = suggestDepartments(newName, knownStores, departments);
  // Once the box holds exactly a suggested name (e.g. after tapping it), don't offer it again.
  const visibleSuggestions = suggestions.filter((s) => s.name !== normalizeText(newName));

  const handleChangeText = (text: string) => {
    setNewName(text);
    setAddError(undefined);
  };

  const add = (name: string) => {
    const result = addDepartment(departments, name);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    onChange(result.departments);
    setNewName('');
    setAddError(undefined);
  };

  // Reuse the existing spelling when the typed name matches one from another store.
  const handleAdd = () => add(suggestions.find((s) => sameName(s.name, newName))?.name ?? newName);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="smallBold">Departments</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Put them in the order you usually walk through the store. Drag the handle to reorder.
        </ThemedText>
      </View>

      <Sortable.Grid
        data={departments}
        keyExtractor={(dept) => dept.id}
        rowGap={Spacing.two}
        customHandle
        scrollableRef={scrollableRef}
        activeItemScale={1.03}
        inactiveItemOpacity={0.7}
        onDragEnd={({ data }) => onChange(data)}
        renderItem={({ item: dept, index }) => (
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <Sortable.Handle>
              <View
                accessible
                accessibilityLabel={`Reorder ${dept.name}, position ${index + 1} of ${departments.length}`}
                accessibilityHint="Drag to move. Screen reader users: use the actions to move up or down."
                accessibilityActions={[
                  ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
                  ...(index < departments.length - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
                ]}
                onAccessibilityAction={(event) =>
                  onChange(moveDepartment(departments, index, event.nativeEvent.actionName === 'moveUp' ? -1 : 1))
                }
                style={styles.handle}>
                <SymbolView
                  name={{ ios: 'line.3.horizontal', android: 'drag_indicator', web: 'drag_indicator' }}
                  tintColor={theme.textSecondary}
                  size={22}
                />
              </View>
            </Sortable.Handle>
            <ThemedText themeColor="textSecondary" style={styles.position}>
              {index + 1}
            </ThemedText>
            <ThemedText style={styles.name}>{dept.name}</ThemedText>
            <Button
              compact
              variant="ghost"
              label="✕"
              accessibilityLabel={`Remove ${dept.name}`}
              onPress={() => onChange(removeDepartment(departments, dept.id))}
            />
          </View>
        )}
      />
      {departments.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No departments yet.
        </ThemedText>
      ) : null}
      {error ? <ErrorText message={error} /> : null}

      {copySources.length > 0 ? (
        <View style={styles.copy}>
          <Button
            compact
            variant="secondary"
            label="Copy from another store"
            accessibilityLabel="Copy departments from another store"
            accessibilityHint="Choose a store; its departments are added here, skipping any already listed."
            onPress={() => {
              setCopyNote(undefined);
              setChoosingCopySource(true);
            }}
          />
          {copyNote ? (
            <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
              {copyNote}
            </ThemedText>
          ) : null}
          <CopyDepartmentsPrompt
            visible={choosingCopySource}
            stores={copySources}
            onChoose={handleCopyFrom}
            onCancel={() => setChoosingCopySource(false)}
          />
        </View>
      ) : null}

      <View style={styles.addRow}>
        <View style={styles.flex}>
          <TextField
            label="New department"
            placeholder="e.g. Bakery"
            value={newName}
            onChangeText={handleChangeText}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            submitBehavior="submit"
            error={addError}
          />
        </View>
        <View style={styles.addButton}>
          <Button compact variant="secondary" label="Add" accessibilityLabel="Add department" onPress={handleAdd} />
        </View>
      </View>

      {visibleSuggestions.length > 0 ? (
        <View style={styles.suggestions} accessibilityLabel="Departments from your other stores">
          <ThemedText type="small" themeColor="textSecondary">
            From your stores, tap to fill in:
          </ThemedText>
          {visibleSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion.name}
              accessibilityRole="button"
              accessibilityLabel={`Use ${suggestion.name}`}
              accessibilityHint={`Fills in the name; then tap Add. Used at ${suggestion.storeNames.join(', ')}.`}
              onPress={() => handleChangeText(suggestion.name)}
              style={({ pressed }) => [
                styles.suggestion,
                { borderColor: theme.border, opacity: pressOpacity(pressed) },
              ]}>
              <ThemedText style={styles.suggestionName}>{suggestion.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
                {suggestion.storeNames.join(', ')}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  header: { gap: Spacing.half, marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
    borderRadius: 10,
  },
  handle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  position: { width: 20 },
  name: { flex: 1 },
  copy: { gap: Spacing.one, alignItems: 'flex-start' },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  flex: { flex: 1 },
  addButton: { paddingTop: 26 },
  suggestions: { gap: Spacing.one },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 10,
  },
  suggestionName: { fontWeight: 600 },
});
