import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { pressOpacity } from '@/components/press-feedback';
import { StatusText } from '@/components/status-text';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { addTag, knownTags, MAX_TAG_LENGTH, removeTag, suggestTags } from '@/domain/tags';
import type { Item } from '@/domain/types';
import { useFocusAfterRemove } from '@/hooks/use-focus-after-remove';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
  /**
   * What's typed in the New tag field, and its error. Kept by the form, so saving can add a tag
   * that was typed but not added yet (see addPendingTag), or say why it can't.
   */
  newTag: string;
  onNewTagChange: (text: string) => void;
  error: string | undefined;
  onErrorChange: (error: string | undefined) => void;
  /** The user's other items, whose tags are suggested while typing and keep their spelling. */
  otherItems: Item[];
};

const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

/**
 * An item's tags (optional): shown as chips that can be removed, with a field to add more and,
 * while typing, matching tags from the user's other items to add with one tap.
 */
export function TagEditor({
  tags,
  onChange,
  newTag,
  onNewTagChange: setNewTag,
  error,
  onErrorChange: setError,
  otherItems,
}: Props) {
  const theme = useTheme();
  const { removeButtonRef, fieldRef, removed } = useFocusAfterRemove();
  /** What just changed, said aloud and shown, e.g. "Added tag Work." */
  const [note, setNote] = useState<string>();
  const [suggestionsHeight, setSuggestionsHeight] = useState(0);

  const known = knownTags(otherItems).map((t) => t.name);
  const suggestions = suggestTags(newTag, otherItems, tags);
  // The suggestions sit below the field; keep them above the keyboard too, so they can be tapped.
  const suggestionsSpace = suggestions.length > 0 && suggestionsHeight > 0 ? suggestionsHeight + Spacing.two : 0;

  const add = (raw: string) => {
    const result = addTag(tags, raw, known);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(result.tags);
    setNewTag('');
    setError(undefined);
    setNote(`Added tag ${result.tag}.`);
  };

  const remove = (tag: string) => {
    removed(tags, tags.indexOf(tag));
    onChange(removeTag(tags, tag));
    setNote(`Removed tag ${tag}.`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Tags
          <ThemedText type="small" themeColor="textSecondary">
            {' '}
            (optional)
          </ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Label items by need or anything else, e.g. Work, Patient, Temporary.
        </ThemedText>
      </View>

      {tags.length > 0 ? (
        <View style={styles.chips}>
          {tags.map((tag) => (
            <View key={tag} style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.controlBorder }]}>
              <ThemedText style={styles.chipText}>{tag}</ThemedText>
              <Button
                ref={removeButtonRef(tag)}
                compact
                variant="ghost"
                label="✕"
                accessibilityLabel={`Remove tag ${tag}`}
                onPress={() => remove(tag)}
              />
            </View>
          ))}
        </View>
      ) : null}
      {note ? <StatusText message={note} /> : null}

      <View style={styles.addRow}>
        <View style={styles.flex}>
          <TextField
            ref={fieldRef}
            label="New tag"
            placeholder="e.g. Work"
            value={newTag}
            onChangeText={(text) => {
              setNewTag(text);
              setError(undefined);
            }}
            onSubmitEditing={() => add(newTag)}
            returnKeyType="done"
            submitBehavior="submit"
            error={error}
            extraSpaceBelow={suggestionsSpace}
            maxLength={MAX_TAG_LENGTH}
          />
        </View>
        <View style={styles.addButton}>
          <Button compact variant="secondary" label="Add" accessibilityLabel="Add tag" onPress={() => add(newTag)} />
        </View>
      </View>

      {suggestions.length > 0 ? (
        <View
          style={styles.suggestions}
          accessibilityLabel="Tags on your other items"
          onLayout={(e) => setSuggestionsHeight(e.nativeEvent.layout.height)}>
          <ThemedText type="small" themeColor="textSecondary">
            Tags on your other items, tap to add:
          </ThemedText>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.name}
              accessibilityRole="button"
              accessibilityLabel={`Add tag ${suggestion.name}`}
              accessibilityHint={`Used on ${countItems(suggestion.count)}.`}
              onPress={() => add(suggestion.name)}
              style={({ pressed }) => [
                styles.suggestion,
                { borderColor: theme.controlBorder, opacity: pressOpacity(pressed) },
              ]}>
              <ThemedText style={styles.suggestionName}>{suggestion.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {countItems(suggestion.count)}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingLeft: Spacing.three,
    borderWidth: 1,
    borderRadius: 24,
  },
  chipText: { flexShrink: 1 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  flex: { flex: 1 },
  addButton: { paddingTop: 26 },
  suggestions: { gap: Spacing.one },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 10,
  },
  suggestionName: { fontWeight: 600 },
});
