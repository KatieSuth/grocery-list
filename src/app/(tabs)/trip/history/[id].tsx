import { useLocalSearchParams } from 'expo-router';
import { storeLabel } from '@/domain/describe';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { directionLabels, directionSpoken, SORT_DIRECTIONS, type SortDirection } from '@/domain/item-sort';
import {
  describeTripItemSpoken,
  formatTripDate,
  formatTripDateSpoken,
  sortTripItems,
  TRIP_ITEM_SORT_LABELS,
  TRIP_ITEM_SORTS,
  type TripItemSort,
} from '@/domain/trip-history';
import type { TripItem } from '@/domain/types';
import { useTrips } from '@/hooks/use-data';
import { useTheme } from '@/hooks/use-theme';

/** A department heading or an item, when the list is grouped by department. */
type Row = { type: 'heading'; key: string; title: string } | { type: 'item'; key: string; item: TripItem };

const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

/** One past trip: where and when, and everything bought, by name (A–Z to start) or by department. */
export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trips = useTrips();
  const [sort, setSort] = useState<TripItemSort>('name');
  const [direction, setDirection] = useState<SortDirection>('asc');
  if (!trips) return null;

  const trip = trips.find((t) => t.id === id);
  if (!trip) {
    return (
      <ThemedView style={[styles.flex, styles.content]}>
        <EmptyState title="Trip not found" message="This trip is no longer in the log." />
      </ThemedView>
    );
  }

  const location = trip.storeLocation;
  const byName = sort === 'name';
  const rows: Row[] = sortTripItems(trip.items, sort, direction).flatMap((group) => [
    ...(group.title === null ? [] : [{ type: 'heading' as const, key: `heading:${group.key}`, title: group.title }]),
    // The same item can't be bought twice on one trip, but keys include the group to be safe.
    ...group.items.map((item) => ({ type: 'item' as const, key: `${group.key}:${item.itemId}`, item })),
  ]);

  return (
    <ThemedView style={styles.flex} testID="trip-detail">
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.header}>
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={`${storeLabel({ name: trip.storeName, location })}. ${formatTripDateSpoken(trip.finishedAt)}. ${countItems(trip.items.length)} bought.`}>
              <ThemedText type="subtitle">{trip.storeName}</ThemedText>
              {location ? <ThemedText themeColor="textSecondary">{location}</ThemedText> : null}
              <ThemedText type="small" themeColor="textSecondary">
                {formatTripDate(trip.finishedAt)} · {countItems(trip.items.length)}
              </ThemedText>
            </View>
            <ChoiceChips
              title="Sort by"
              choices={TRIP_ITEM_SORTS.map((value) => ({
                value,
                label: TRIP_ITEM_SORT_LABELS[value],
                spoken: `Sort by ${TRIP_ITEM_SORT_LABELS[value].toLowerCase()}`,
              }))}
              selected={sort}
              onChange={setSort}
            />
            <ChoiceChips
              title="Order"
              choices={SORT_DIRECTIONS.map((value) => ({
                value,
                label: directionLabels('name')[value],
                spoken: directionSpoken('name')[value],
              }))}
              selected={direction}
              onChange={setDirection}
            />
          </View>
        }
        renderItem={({ item: row }) =>
          row.type === 'heading' ? (
            <ThemedText type="smallBold" accessibilityRole="header" testID="trip-item-heading" style={styles.heading}>
              {row.title}
            </ThemedText>
          ) : (
            <TripItemLine item={row.item} withDepartment={byName} />
          )
        }
      />
    </ThemedView>
  );
}

/** One item bought: name, then brand, quantity and (when not grouped by it) department. */
function TripItemLine({ item, withDepartment }: { item: TripItem; withDepartment: boolean }) {
  const theme = useTheme();
  const details = [item.brand, item.quantity, withDepartment ? item.department : undefined].filter((d) => d);
  return (
    <View
      accessible
      testID="trip-item"
      accessibilityLabel={describeTripItemSpoken(item, withDepartment)}
      style={[styles.item, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.name}>{item.name}</ThemedText>
      {details.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {details.join(' · ')}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  heading: { marginTop: Spacing.two },
  item: { minHeight: 48, justifyContent: 'center', padding: Spacing.three, borderRadius: 12, gap: Spacing.half },
  name: { fontWeight: 600 },
  separator: { height: Spacing.two },
});
