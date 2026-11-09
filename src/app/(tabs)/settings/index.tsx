import { use, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { Screen } from '@/components/screen';
import { SortChoices } from '@/components/sort-choices';
import { ErrorText } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deleteAllData } from '@/data/erase-repo';
import { applyImportPlan, loadImportContext } from '@/data/import-repo';
import { setColorSchemeChoice, setItemSortChoice } from '@/data/settings-repo';
import { useDatabase } from '@/db/database-provider';
import { COLOR_SCHEME_CHOICES, COLOR_SCHEME_LABELS, COLOR_SCHEME_SPOKEN } from '@/domain/appearance';
import {
  describeImportErrors,
  describeImportPlan,
  describeImportResult,
  isEmptyImport,
  parseImportCsv,
  planImport,
  type ImportPlan,
} from '@/domain/csv-import';
import { ColorSchemeChoiceContext } from '@/hooks/color-scheme-choice';
import { useItemSortChoice } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, confirmDestructive } from '@/utils/confirm';
import { notify } from '@/utils/notify';
import { pickCsvFile } from '@/utils/pick-csv-file';

const CANT_IMPORT = 'Can’t import this file';

/** Light/dark appearance, the items' default sort, importing from a CSV file, and deleting everything to start over. */
export default function SettingsScreen() {
  const db = useDatabase();
  const colorScheme = use(ColorSchemeChoiceContext);
  const sortChoice = useItemSortChoice();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  /** What the import is doing, while it's working: shown with a spinner. */
  const [importStatus, setImportStatus] = useState<'checking' | 'saving'>();
  const [importError, setImportError] = useState<string>();
  const theme = useTheme();

  const applyImport = async (plan: ImportPlan) => {
    setImportStatus('saving');
    try {
      await applyImportPlan(db, plan);
      notify('Imported', describeImportResult(plan.counts));
    } catch {
      setImportError('Could not finish the import. Some of it may have been saved; check your stores and items.');
    } finally {
      setImportStatus(undefined);
    }
  };

  /**
   * Pick → read → check every row; returns what to show next (an error, or the question before
   * importing). Nothing is written unless the whole file is valid.
   */
  const checkFile = async (): Promise<(() => void) | undefined> => {
    // The spinner starts once a file is chosen: the browser never says if its chooser is canceled.
    const picked = await pickCsvFile(() => setImportStatus('checking'));
    if (picked.status === 'canceled') return undefined;
    if (picked.status === 'error') return () => notify(CANT_IMPORT, picked.message);

    const parsed = parseImportCsv(picked.text);
    if (!parsed.ok) return () => notify(CANT_IMPORT, describeImportErrors(parsed.errors));
    const { stores, items } = await loadImportContext(db);
    const planned = planImport(parsed.rows, stores, items);
    if (!planned.ok) return () => notify(CANT_IMPORT, describeImportErrors(planned.errors));

    const { plan } = planned;
    if (isEmptyImport(plan.counts)) {
      return () => notify('Nothing new to import', 'Everything in this file is already in your list.');
    }
    return () =>
      confirmAction({
        title: 'Import from CSV?',
        message: describeImportPlan(plan.counts),
        confirmLabel: 'Import',
        onConfirm: () => void applyImport(plan),
      });
  };

  const handleImport = async () => {
    setImportError(undefined);
    let next: (() => void) | undefined;
    try {
      next = await checkFile();
    } catch {
      setImportError('Could not import that file. Please try again.');
    } finally {
      // Stop the spinner before showing the result.
      setImportStatus(undefined);
    }
    next?.();
  };

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

      {sortChoice ? (
        <View style={styles.section}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Items list
          </ThemedText>
          <SortChoices
            asDefault
            sort={sortChoice.sort}
            direction={sortChoice.direction}
            onChangeSort={(sort) => void setItemSortChoice(db, { ...sortChoice, sort })}
            onChangeDirection={(direction) => void setItemSortChoice(db, { ...sortChoice, direction })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            How the Items tab is sorted when it opens. Sorting there changes it only until you leave the app.
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Your data
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your stores, items, list and trip history are stored only on this device.
        </ThemedText>
        <View style={styles.row}>
          <Button
            label="Import from CSV"
            variant="secondary"
            disabled={importStatus !== undefined}
            accessibilityHint="Choose a CSV file of stores, items and departments to add"
            onPress={() => void handleImport()}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Columns: Store, Item name, Department, Brand (optional). A header row is fine. New stores and departments are
          added, and items already in your list are skipped.
        </ThemedText>
        {importStatus ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <ActivityIndicator color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {importStatus === 'checking' ? 'Checking the file…' : 'Importing…'}
            </ThemedText>
          </View>
        ) : null}
        {importError ? <ErrorText message={importError} /> : null}
        <View style={styles.row}>
          <Button
            label="Delete all data"
            variant="danger"
            disabled={deleting || importStatus !== undefined}
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
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
