import { use, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { Screen } from '@/components/screen';
import { ErrorText } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deleteAllData } from '@/data/erase-repo';
import { setColorSchemeChoice } from '@/data/settings-repo';
import { useDatabase } from '@/db/database-provider';
import { COLOR_SCHEME_CHOICES, COLOR_SCHEME_LABELS, COLOR_SCHEME_SPOKEN } from '@/domain/appearance';
import { ColorSchemeChoiceContext } from '@/hooks/color-scheme-choice';
import { confirmDestructive } from '@/utils/confirm';

/** Light/dark appearance, and deleting everything to start over. */
export default function SettingsScreen() {
  const db = useDatabase();
  const colorScheme = use(ColorSchemeChoiceContext);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  const deleteEverything = async () => {
    setDeleting(true);
    setError(undefined);
    try {
      // On success the app returns to setup and this screen goes away.
      await deleteAllData(db);
    } catch {
      setError('Could not delete all of your data. Please try again.');
      setDeleting(false);
    }
  };

  const handleDelete = () =>
    confirmDestructive({
      title: 'Delete all data?',
      message:
        'This permanently deletes your stores, items, shopping list and trip history from this device, then starts setup again. It can’t be undone.',
      confirmLabel: 'Delete everything',
      onConfirm: () => void deleteEverything(),
    });

  return (
    <Screen testID="settings-screen">
      <View style={styles.section}>
        <ChoiceChips
          title="Appearance"
          choices={COLOR_SCHEME_CHOICES.map((value) => ({
            value,
            label: COLOR_SCHEME_LABELS[value],
            spoken: COLOR_SCHEME_SPOKEN[value],
          }))}
          selected={colorScheme}
          onChange={(choice) => void setColorSchemeChoice(db, choice)}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {colorScheme === 'system'
            ? 'Follows your device’s light or dark setting.'
            : `Always ${COLOR_SCHEME_LABELS[colorScheme].toLowerCase()}, whatever your device is set to.`}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Your data
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your stores, items, list and trip history are stored only on this device.
        </ThemedText>
        <View style={styles.row}>
          <Button
            label="Delete all data"
            variant="danger"
            disabled={deleting}
            accessibilityHint="Asks first, then deletes your stores, items, list and trip history and starts setup again"
            onPress={handleDelete}
          />
        </View>
        {error ? <ErrorText message={error} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  row: { flexDirection: 'row' },
});
