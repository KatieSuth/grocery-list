import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { StoreDropdown } from '@/components/store-dropdown';
import { ErrorText } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ToggleSwitch } from '@/components/toggle-switch';
import { TripItemRow } from '@/components/trip-item-row';
import { Spacing } from '@/constants/theme';
import { clearCart, setInCart } from '@/data/list-repo';
import { clearTripStore, setTripReversed, setTripStore } from '@/data/settings-repo';
import { finishTrip } from '@/data/trips-repo';
import { useDatabase } from '@/db/database-provider';
import { buildTripList } from '@/domain/trip';
import type { Store } from '@/domain/types';
import { useItems, useListEntries, useStores, useTripSettings } from '@/hooks/use-data';
import { confirmAction } from '@/utils/confirm';

const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

/**
 * The shopping trip: pick the store you're at, then check off the items from your list that are
 * sold there, in the order you walk through it. Finish logs them as bought.
 */
export default function TripScreen() {
  const db = useDatabase();
  const stores = useStores();
  const items = useItems();
  const entries = useListEntries();
  const settings = useTripSettings();
  const [finishing, setFinishing] = useState(false);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  if (!stores || !items || !entries || !settings) return null;

  if (stores.length === 0) {
    return (
      <Screen>
        <EmptyState title="No stores to shop at yet" message="Add the stores you shop at on the Stores tab." />
      </Screen>
    );
  }

  // The chosen store may have been deleted since.
  const store = stores.find((s) => s.id === settings.storeId);
  const list = store ? buildTripList(store, items, entries, settings.reversed) : undefined;

  /** Logs the cart at the current store as bought. Returns whether it worked. */
  const finish = async (current: Store): Promise<boolean> => {
    setFinishing(true);
    setError(undefined);
    try {
      const record = await finishTrip(db, current.id);
      // Nothing logged if everything was taken out of the cart (or unchecked) before confirming.
      setNote(
        record
          ? `Trip finished: ${countItems(record.items.length)} logged as bought.`
          : 'Nothing was checked off, so there was nothing to log.',
      );
      return true;
    } catch {
      setError('Could not finish the trip. Please try again.');
      return false;
    } finally {
      setFinishing(false);
    }
  };

  const switchTo = async (next: Store) => {
    // A new trip starts with an empty cart.
    await clearCart(db);
    await setTripStore(db, next.id);
  };

  const handleChooseStore = (next: Store) => {
    if (next.id === store?.id) return;
    setNote(undefined);
    if (!store || !list || list.inCartCount === 0) {
      void switchTo(next);
      return;
    }
    // Don't leave checked-off items behind at the old store.
    confirmAction({
      title: `Done with your trip at ${store.name}?`,
      message: `You've checked off ${countItems(list.inCartCount)} here. Finish this trip to log them as bought, then switch to ${next.name}. If you're not done, you'll stay at ${store.name}.`,
      confirmLabel: 'Finish and switch',
      cancelLabel: 'Not yet',
      onConfirm: () =>
        void finish(store).then(async (ok) => {
          if (ok) await switchTo(next);
        }),
    });
  };

  const handleFinish = (current: Store, inCart: number, remaining: number) => {
    confirmAction({
      title: `Finish your trip at ${current.name}?`,
      message:
        `${countItems(inCart)} you checked off will be logged as bought and unchecked from your list.` +
        (remaining > 0 ? ` ${countItems(remaining)} you didn't check off will stay on your list.` : ''),
      confirmLabel: 'Finish trip',
      // The trip is over, so the next one starts by choosing a store.
      onConfirm: () =>
        void finish(current).then(async (ok) => {
          if (ok) await clearTripStore(db);
        }),
    });
  };

  return (
    <Screen
      testID="trip-screen"
      footer={
        store && list ? (
          <View style={styles.footer}>
            <Button
              label="Finish trip"
              disabled={finishing || list.inCartCount === 0}
              accessibilityHint="Logs the items you checked off as bought and unchecks them from your list"
              onPress={() => handleFinish(store, list.inCartCount, list.remainingCount)}
            />
          </View>
        ) : undefined
      }>
      <StoreDropdown stores={stores} selected={store} onChoose={handleChooseStore} />

      {note ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {note}
        </ThemedText>
      ) : null}
      {error ? <ErrorText message={error} /> : null}

      {!store || !list ? (
        <EmptyState title="Where are you shopping?" message="Choose a store to see what to get there." />
      ) : (
        <>
          <View style={styles.toolbar}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {list.remainingCount + list.inCartCount === 0
                ? 'Nothing to get here'
                : `${list.inCartCount} of ${list.remainingCount + list.inCartCount} in cart`}
            </ThemedText>
            <View style={styles.reverse}>
              <ThemedText type="small">Reverse order</ThemedText>
              <ToggleSwitch
                accessibilityLabel="Reverse order"
                accessibilityHint="Lists departments in the opposite order, for walking the store the other way"
                value={settings.reversed}
                onValueChange={(reversed) => void setTripReversed(db, reversed)}
              />
            </View>
          </View>

          {list.sections.length === 0 ? (
            <EmptyState
              title={`Nothing to get at ${store.name}`}
              message="Check items on the Items tab that are sold here, and they'll show up in department order."
            />
          ) : (
            list.sections.map((section) => (
              <View key={section.department.id} style={styles.section}>
                <ThemedText type="smallBold" accessibilityRole="header">
                  {section.department.name}
                </ThemedText>
                {section.rows.map((row) => (
                  <TripItemRow
                    key={row.item.id}
                    row={row}
                    onToggle={() => void setInCart(db, row.item.id, !row.inCart)}
                  />
                ))}
              </View>
            ))
          )}

          {list.elsewhereCount > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {list.elsewhereCount === 1
                ? `1 checked item isn't sold at ${store.name}.`
                : `${list.elsewhereCount} checked items aren't sold at ${store.name}.`}
            </ThemedText>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  reverse: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  section: { gap: Spacing.two },
});
