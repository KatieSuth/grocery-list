import { SymbolView } from 'expo-symbols';
import { useDeferredValue, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Sortable, { type SortableGridProps } from 'react-native-sortables';

import { Button } from '@/components/button';
import { CopyDepartmentsPrompt } from '@/components/copy-departments-prompt';
import { StatusText } from '@/components/status-text';
import { pressOpacity } from '@/components/press-feedback';
import { ErrorText, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  addDepartmentFromStores,
  copyDepartments,
  moveDepartment,
  removeDepartment,
  suggestDepartments,
} from '@/domain/departments';
import { MAX_NAME_LENGTH } from '@/domain/names';
import type { Department, Store } from '@/domain/types';
import { normalizeText } from '@/utils/text';
import { useFocusAfterRemove } from '@/hooks/use-focus-after-remove';
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
  /**
   * What's typed in the New department field, and its error. Kept by the form, so saving can add
   * a department that was typed but not added yet (see addPendingDepartment), or say why it can't.
   */
  newName: string;
  onNewNameChange: (text: string) => void;
  addError: string | undefined;
  onAddErrorChange: (error: string | undefined) => void;
};

/** Ordered department list: reorder, remove, and add departments (with suggestions from other stores). */
export function DepartmentEditor({
  departments,
  onChange,
  error,
  knownStores,
  currentStoreId,
  scrollableRef,
  newName,
  onNewNameChange: setNewName,
  addError,
  onAddErrorChange: setAddError,
}: Props) {
  const theme = useTheme();
  const { removeButtonRef, fieldRef, removed } = useFocusAfterRemove();
  const [choosingCopySource, setChoosingCopySource] = useState(false);
  const [copyNote, setCopyNote] = useState<string>();
  const [suggestionsHeight, setSuggestionsHeight] = useState(0);
  // Each draggable row is costly to build (animated views, a gesture handler, a measurement pass),
  // so with many departments the screen would be slow to open. Show the rest of the form first
  // and build the list in the render right after.
  const showList = useDeferredValue(true, false);

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
  // The suggestions sit below the field; keep them above the keyboard too, so they can be tapped.
  const suggestionsSpace = visibleSuggestions.length > 0 && suggestionsHeight > 0 ? suggestionsHeight + Spacing.two : 0;

  const handleChangeText = (text: string) => {
    setNewName(text);
    setAddError(undefined);
  };

  // Reuses the existing spelling when the typed name matches one from another store.
  const handleAdd = () => {
    const result = addDepartmentFromStores(departments, newName, knownStores);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    onChange(result.departments);
    setNewName('');
    setAddError(undefined);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Departments
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Put them in the order you usually walk through the store. Drag the handle to reorder.
        </ThemedText>
      </View>

      {!showList && departments.length > 0 ? (
        <ActivityIndicator
          accessibilityLabel="Loading departments"
          color={theme.textSecondary}
          style={styles.loading}
        />
      ) : null}
      {showList ? (
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
              {/* The drag handle already says "position 1 of 4"; don't read the number again. */}
              <ThemedText
                themeColor="textSecondary"
                style={styles.position}
                accessibilityElementsHidden
                importantForAccessibility="no">
                {index + 1}
              </ThemedText>
              <ThemedText style={styles.name}>{dept.name}</ThemedText>
              <Button
                ref={removeButtonRef(dept.id)}
                compact
                variant="ghost"
                label="✕"
                accessibilityLabel={`Remove ${dept.name}`}
                onPress={() => {
                  removed(
                    departments.map((d) => d.id),
                    index,
                  );
                  onChange(removeDepartment(departments, dept.id));
                }}
              />
            </View>
          )}
        />
      ) : null}
      {departments.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No departments yet. For example: Produce, Deli, Frozen.
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
          {copyNote ? <StatusText message={copyNote} /> : null}
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
            ref={fieldRef}
            label="New department"
            placeholder="e.g. Bakery"
            value={newName}
            onChangeText={handleChangeText}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            submitBehavior="submit"
            error={addError}
            extraSpaceBelow={suggestionsSpace}
            maxLength={MAX_NAME_LENGTH}
          />
        </View>
        <View style={styles.addButton}>
          <Button compact variant="secondary" label="Add" accessibilityLabel="Add department" onPress={handleAdd} />
        </View>
      </View>

      {visibleSuggestions.length > 0 ? (
        <View
          style={styles.suggestions}
          accessibilityLabel="Departments from your other stores"
          onLayout={(e) => setSuggestionsHeight(e.nativeEvent.layout.height)}>
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
                { borderColor: theme.controlBorder, opacity: pressOpacity(pressed) },
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
  // Grows with large text, so "10" and up aren't cut off.
  position: { minWidth: 20 },
  name: { flex: 1 },
  copy: { gap: Spacing.one, alignItems: 'flex-start' },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  flex: { flex: 1 },
  addButton: { paddingTop: 26 },
  loading: { paddingVertical: Spacing.three },
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
