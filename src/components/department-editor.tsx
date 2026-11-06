import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { pressOpacity } from '@/components/press-feedback';
import { ErrorText, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { addDepartment, moveDepartment, removeDepartment, suggestDepartments } from '@/domain/departments';
import type { Department, Store } from '@/domain/types';
import { normalizeText, sameName } from '@/utils/text';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  departments: Department[];
  onChange: (departments: Department[]) => void;
  error?: string;
  /** Saved stores, whose departments are offered as suggestions while typing a new one. */
  knownStores: Store[];
};

/** Ordered department list: reorder, remove, and add departments (with suggestions from other stores). */
export function DepartmentEditor({ departments, onChange, error, knownStores }: Props) {
  const theme = useTheme();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string>();

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
          Put them in the order you usually walk through the store.
        </ThemedText>
      </View>

      {departments.map((dept, index) => (
        <View
          key={dept.id}
          style={[styles.row, { backgroundColor: theme.backgroundElement }]}
          accessibilityLabel={`${dept.name}, position ${index + 1} of ${departments.length}`}>
          <ThemedText themeColor="textSecondary" style={styles.position}>
            {index + 1}
          </ThemedText>
          <ThemedText style={styles.name}>{dept.name}</ThemedText>
          <Button
            compact
            variant="ghost"
            label="↑"
            accessibilityLabel={`Move ${dept.name} up`}
            disabled={index === 0}
            onPress={() => onChange(moveDepartment(departments, index, -1))}
          />
          <Button
            compact
            variant="ghost"
            label="↓"
            accessibilityLabel={`Move ${dept.name} down`}
            disabled={index === departments.length - 1}
            onPress={() => onChange(moveDepartment(departments, index, 1))}
          />
          <Button
            compact
            variant="ghost"
            label="✕"
            accessibilityLabel={`Remove ${dept.name}`}
            onPress={() => onChange(removeDepartment(departments, dept.id))}
          />
        </View>
      ))}
      {departments.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No departments yet.
        </ThemedText>
      ) : null}
      {error ? <ErrorText message={error} /> : null}

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
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
    borderRadius: 10,
  },
  position: { width: 20 },
  name: { flex: 1 },
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
