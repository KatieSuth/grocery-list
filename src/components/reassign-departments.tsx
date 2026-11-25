import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View, type HostInstance } from 'react-native';

import { Button } from '@/components/button';
import { PickerSheet } from '@/components/picker-sheet';
import { pressOpacity } from '@/components/press-feedback';
import { Screen } from '@/components/screen';
import { StatusText } from '@/components/status-text';
import { ErrorText, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { addDepartmentFromStores, sortDepartmentsByName } from '@/domain/departments';
import { MAX_NAME_LENGTH } from '@/domain/names';
import { unassignedCount, type DepartmentToReassign, type ItemToReassign } from '@/domain/store-draft';
import { describeTags } from '@/domain/tags';
import type { Department, Store } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { moveAccessibilityFocus } from '@/utils/accessibility-focus';
import { confirmDestructive } from '@/utils/confirm';
import { normalizeText, sameName } from '@/utils/text';

type Props = {
  /** The store's name, as saved. */
  storeName: string;
  /** The departments being removed that items are in, with those items. */
  groups: DepartmentToReassign[];
  /** The store's departments as they'll be after saving (the draft's). */
  departments: Department[];
  /** Departments added on this screen, in the order added (they go at the end of the store's). */
  added: Department[];
  onAddedChange: (added: Department[]) => void;
  /** The new department chosen for each item: item id → department id. */
  choices: Record<string, string | undefined>;
  onChoicesChange: (choices: Record<string, string | undefined>) => void;
  /** All saved stores, so a typed name reuses the spelling used elsewhere. */
  knownStores: Store[];
  /** The departments being removed: their names can't be used for new ones. */
  removedDepartments: Department[];
  saving: boolean;
  /** Why the last save failed, if it did. */
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const NEW_DEPARTMENT = '__new__';
const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);
const joinList = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/**
 * Before departments that items are in are deleted: each of those items, with a dropdown to
 * choose its new department at the store (or add one). Items left without one lose this store,
 * and any not listed at another store are left with no store.
 */
export function ReassignDepartments({
  storeName,
  groups,
  departments,
  added,
  onAddedChange,
  choices,
  onChoicesChange,
  knownStores,
  removedDepartments,
  saving,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const heading = useRef<HostInstance>(null);
  const fields = useRef(new Map<string, HostInstance>());
  /** The item whose department list is (or was last) open; kept while it closes, for its title. */
  const [choosingFor, setChoosingFor] = useState<ItemToReassign>();
  const [listOpen, setListOpen] = useState(false);
  /** The item "New department…" was chosen for, while its dialog is (about to be) open. */
  const [newFor, setNewFor] = useState<ItemToReassign>();
  /** The New department dialog: shown, or (on iOS) closing. */
  const [dialog, setDialog] = useState<'open' | 'closing'>();
  // What to do once the list or dialog has finished closing (iOS, where showing a dialog or moving
  // the screen reader while a modal is still closing doesn't work). Refs, so the Modal's onDismiss
  // sees them whichever render that handler came from.
  const openDialogOnDismiss = useRef(false);
  const returnFocusOnDismiss = useRef<string | undefined>(undefined);
  const [note, setNote] = useState<string>();
  /** The item whose field the screen reader should move back to. */
  const [returnTo, setReturnTo] = useState<{ id: string }>();

  const names = groups.map((g) => g.department.name);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const options = sortDepartmentsByName([...departments, ...added]);
  const title = `Reassign ${countItems(total)} from ${joinList(names)}`;

  // Start the screen reader at the top of this screen. (The heading is always shown.)
  useEffect(() => {
    moveAccessibilityFocus(heading.current as HostInstance);
  }, []);
  useEffect(() => {
    const field = returnTo && fields.current.get(returnTo.id);
    if (field) moveAccessibilityFocus(field);
  }, [returnTo]);

  /** Moves the screen reader back to an item's field, once any closing modal has gone. */
  const returnFocus = (id: string) => {
    if (Platform.OS === 'ios') returnFocusOnDismiss.current = id;
    else setReturnTo({ id });
  };
  /** A modal has finished closing (iOS): move the screen reader as was waiting (always set by then). */
  const dismissed = () => {
    setReturnTo({ id: returnFocusOnDismiss.current as string });
    returnFocusOnDismiss.current = undefined;
  };

  const choose = (item: ItemToReassign, key: string) => {
    setListOpen(false);
    if (key === NEW_DEPARTMENT) {
      setNewFor(item);
      // iOS can't show the dialog while the list is still closing; it opens once it's gone.
      if (Platform.OS === 'ios') openDialogOnDismiss.current = true;
      else setDialog('open');
      return;
    }
    onChoicesChange({ ...choices, [item.item.id]: key });
    returnFocus(item.item.id);
  };

  const closeDialog = (department?: Department) => {
    const item = newFor as ItemToReassign;
    // On iOS the dialog stays until it has finished closing (see dismissed).
    setDialog(Platform.OS === 'ios' ? 'closing' : undefined);
    setNewFor(undefined);
    if (department) {
      onAddedChange([...added, department]);
      setNote(`Added ${department.name} at the end of ${storeName}’s departments.`);
    }
    // Cancelled: back to "Select".
    onChoicesChange({ ...choices, [item.item.id]: department?.id });
    returnFocus(item.item.id);
  };

  const confirm = () => {
    const unassigned = unassignedCount(groups, choices);
    if (unassigned === 0) {
      onConfirm();
      return;
    }
    const one = unassigned === 1;
    confirmDestructive({
      title: `${countItems(unassigned)} ${one ? 'isn’t' : 'aren’t'} reassigned`,
      message: one
        ? `It’ll no longer be listed under ${storeName}. If it isn’t listed at another store, it will be left with no store, and won’t show up on a shopping trip.`
        : `They’ll no longer be listed under ${storeName}. Any that aren’t listed at another store will be left with no store, and won’t show up on a shopping trip.`,
      confirmLabel: 'Continue',
      cancelLabel: 'Keep reassigning',
      onConfirm,
    });
  };

  const valueFor = (item: ItemToReassign) => {
    if (newFor?.item.id === item.item.id) return 'New department…';
    const chosen = options.find((d) => d.id === choices[item.item.id]);
    return chosen?.name;
  };

  return (
    <Screen
      footer={
        <>
          <Button
            variant="secondary"
            label="Cancel"
            accessibilityLabel="Cancel, back to the store"
            disabled={saving}
            onPress={onCancel}
          />
          <Button
            // Short enough for a phone's footer; the spoken label says which departments go.
            label="Reassign items & delete"
            accessibilityLabel={`Reassign items and delete ${joinList(names)}`}
            disabled={saving}
            onPress={confirm}
          />
        </>
      }>
      <View ref={heading} accessible accessibilityRole="header" accessibilityLabel={title}>
        <ThemedText type="subtitle">{title}</ThemedText>
      </View>
      <ThemedText>
        {groups.length === 1
          ? `${names[0]} has ${countItems(total)} at ${storeName}. Deleting it takes them off ${storeName}.`
          : `${joinList(names)} have ${countItems(total)} at ${storeName}. Deleting them takes those items off ${storeName}.`}{' '}
        Choose a new department for each one below.
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Any you don’t reassign, and that aren’t listed at another store, will be left with no store: they stay in your
        Items list, but won’t show up on a shopping trip until you give them one.
      </ThemedText>
      {note ? <StatusText message={note} /> : null}
      {error ? <ErrorText message={error} /> : null}

      {groups.map((group) => (
        <View key={group.department.id} style={styles.group}>
          <ThemedText type="smallBold" accessibilityRole="header">
            From {group.department.name}, {countItems(group.items.length)}
          </ThemedText>
          {group.items.map((entry) => (
            <ItemRow
              key={entry.item.id}
              entry={entry}
              storeName={storeName}
              value={valueFor(entry)}
              open={listOpen && choosingFor?.item.id === entry.item.id}
              onOpen={() => {
                setChoosingFor(entry);
                setListOpen(true);
              }}
              fieldRef={(field) => {
                if (field) fields.current.set(entry.item.id, field);
                else fields.current.delete(entry.item.id);
              }}
            />
          ))}
        </View>
      ))}

      <PickerSheet
        visible={listOpen}
        title={`Department for ${choosingFor?.item.name ?? 'this item'}`}
        options={[
          ...options.map((d) => ({
            key: d.id,
            title: d.name,
            accessibilityLabel: d.name,
            current: !!choosingFor && choices[choosingFor.item.id] === d.id,
          })),
          {
            key: NEW_DEPARTMENT,
            title: 'New department…',
            accessibilityLabel: 'New department…',
            accessibilityHint: `Add a department to ${storeName} for this item`,
          },
        ]}
        onChoose={(key) => choose(choosingFor as ItemToReassign, key)}
        onCancel={() => {
          setListOpen(false);
          returnFocus((choosingFor as ItemToReassign).item.id);
        }}
        onDismiss={() => {
          if (openDialogOnDismiss.current) {
            openDialogOnDismiss.current = false;
            setDialog('open');
            return;
          }
          dismissed();
        }}
        cancelAccessibilityLabel={`Cancel choosing a department for ${choosingFor?.item.name ?? 'this item'}`}
      />
      {dialog ? (
        <DepartmentNameDialog
          visible={dialog === 'open'}
          onDismiss={() => {
            setDialog(undefined);
            dismissed();
          }}
          storeName={storeName}
          departments={[...departments, ...added]}
          knownStores={knownStores}
          removedDepartments={removedDepartments}
          onAdd={(department) => closeDialog(department)}
          onCancel={() => closeDialog()}
        />
      ) : null}
    </Screen>
  );
}

function ItemRow({
  entry: { item, otherStores },
  storeName,
  value,
  open,
  onOpen,
  fieldRef,
}: {
  entry: ItemToReassign;
  storeName: string;
  value: string | undefined;
  open: boolean;
  onOpen: () => void;
  fieldRef: (field: HostInstance | null) => void;
}) {
  const theme = useTheme();
  const tags = describeTags(item.tags);
  const where = otherStores.length > 0 ? `Also at ${otherStores.join('; ')}` : `Only at ${storeName}`;
  const details = [item.brand, tags.shown].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View
        accessible
        accessibilityLabel={`${item.brand ? `${item.name}, ${item.brand}` : item.name}.${tags.spoken ? ` ${tags.spoken}.` : ''} ${where}.`}>
        <ThemedText style={styles.name}>{item.name}</ThemedText>
        {details ? (
          <ThemedText type="small" themeColor="textSecondary">
            {details}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {where}
        </ThemedText>
      </View>
      <Pressable
        ref={fieldRef}
        accessibilityRole="button"
        accessibilityLabel={`Department at ${storeName} for ${item.name}: ${value ?? 'Select'}`}
        accessibilityHint="Opens the list of departments"
        aria-expanded={open}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.background, borderColor: theme.controlBorder, opacity: pressOpacity(pressed) },
        ]}>
        <ThemedText style={[styles.flex, value ? styles.value : { color: theme.textSecondary }]}>{value ?? 'Select'}</ThemedText>
        <ThemedText themeColor="textSecondary" accessibilityElementsHidden importantForAccessibility="no">
          ▾
        </ThemedText>
      </Pressable>
    </View>
  );
}

/**
 * Asks for a new department's name, with the store form's rules: no name already in the list or
 * being removed (ignoring case and spacing), the name rules, and the spelling used at other stores. A problem
 * shows while typing; a blank name only once Add is tapped.
 */
function DepartmentNameDialog({
  visible,
  onDismiss,
  storeName,
  departments,
  knownStores,
  removedDepartments,
  onAdd,
  onCancel,
}: {
  visible: boolean;
  /** iOS only: it has finished closing. */
  onDismiss: () => void;
  storeName: string;
  departments: Department[];
  knownStores: Store[];
  removedDepartments: Department[];
  onAdd: (department: Department) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const result = addDepartmentFromStores(departments, name, knownStores, removedDepartments);
  // A department being removed can't be re-created here; its removal is cancelled on the store form.
  const removing = removedDepartments.find((d) => sameName(d.name, name));
  const message = removing
    ? `"${removing.name}" is being removed. To keep it, go back to the store and cancel the removal instead.`
    : !result.ok
      ? result.error
      : undefined;
  const error = message && (tried || normalizeText(name)) ? message : undefined;

  // Start the screen reader on the name field. (It's always shown.)
  useEffect(() => {
    moveAccessibilityFocus(field.current as HostInstance);
  }, []);

  const add = () => {
    setTried(true);
    if (result.ok) onAdd(result.departments[result.departments.length - 1]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} onDismiss={onDismiss}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          aria-label={`New department at ${storeName}`}
          style={[styles.dialog, { backgroundColor: theme.background }]}>
          <ThemedText type="subtitle" accessibilityRole="header">
            New department at {storeName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            It’s added at the end of {storeName}’s departments. You can move it on the store’s page.
          </ThemedText>
          <TextField
            ref={field}
            label="Department name"
            placeholder="e.g. Bakery"
            value={name}
            onChangeText={setName}
            onSubmitEditing={add}
            returnKeyType="done"
            submitBehavior="submit"
            error={error}
            autoFocus
            maxLength={MAX_NAME_LENGTH}
          />
          <View style={styles.buttons}>
            <Button variant="secondary" label="Cancel" accessibilityLabel="Cancel adding a department" onPress={onCancel} />
            <Button label="Add" accessibilityLabel="Add department" onPress={add} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  row: { gap: Spacing.two, padding: Spacing.three, borderRadius: 12 },
  name: { fontWeight: 600 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 10,
  },
  flex: { flex: 1 },
  value: { fontWeight: 600 },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  buttons: { flexDirection: 'row', gap: Spacing.two },
});
