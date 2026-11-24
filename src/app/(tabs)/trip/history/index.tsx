import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { FilterIconButton } from '@/components/filter-button';
import { SearchField } from '@/components/search-field';
import { StatusText } from '@/components/status-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripFilterPanel } from '@/components/trip-filter-panel';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  activeTripFilterCount,
  applyTripFilter,
  EMPTY_TRIP_FILTER,
  formatDaySpoken,
  formatTripDate,
  formatTripDateSpoken,
  getTripStoreOptions,
  PRESET_LABELS,
  pruneTripFilter,
  rangeDays,
  type TripDateRange,
} from '@/domain/trip-history';
import { useTrips } from '@/hooks/use-data';
import { normalizeText } from '@/utils/text';

const countTrips = (n: number) => (n === 1 ? '1 trip' : `${n} trips`);

/** "last 90 days", or "November 1, 2026 to November 23, 2026": the dates shown, as spoken. */
function describeRange(range: TripDateRange, now: number): string {
  if (range.preset !== 'custom') return PRESET_LABELS[range.preset].toLowerCase();
  const { from, to } = rangeDays(range, now);
  return `${formatDaySpoken(from)} to ${formatDaySpoken(to)}`;
}

/**
 * The trip log: every finished trip, newest first, by store, location and date. Searchable by
 * what was bought, and filterable by date range (the last 90 days to start with) and store.
 */
export default function TripHistoryScreen() {
  const trips = useTrips();
  const [rawFilter, setFilter] = useState(EMPTY_TRIP_FILTER);
  const [panelOpen, setPanelOpen] = useState(false);
  // Date ranges count back from today: refreshed whenever the screen is shown, so they stay right across days.
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  if (!trips) return null;

  const storeOptions = getTripStoreOptions(trips);
  // Ignore selected stores whose trips have since been deleted.
  const filter = pruneTripFilter(rawFilter, storeOptions);
  const filterCount = activeTripFilterCount(filter);
  const searching = !!normalizeText(filter.query);
  const visible = applyTripFilter(trips, filter, now);
  const clearFilters = () => setFilter({ ...EMPTY_TRIP_FILTER, query: filter.query });

  return (
    <ThemedView style={styles.flex} testID="trip-history">
      <FlatList
        data={visible}
        keyExtractor={(trip) => trip.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchRow}>
              <SearchField
                label="Search items or brands bought"
                placeholder="Search items or brands"
                value={filter.query}
                onChangeText={(query) => setFilter({ ...filter, query })}
              />
              <FilterIconButton
                label={`Filter trips, ${describeRange(filter.range, now)}`}
                count={filterCount}
                expanded={panelOpen}
                onPress={() => setPanelOpen(!panelOpen)}
              />
            </View>

            {panelOpen ? (
              <TripFilterPanel storeOptions={storeOptions} filter={filter} onChange={setFilter} now={now} />
            ) : null}

            {filterCount > 0 ? (
              <View style={styles.summary}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {filterCount === 1 ? '1 filter on' : `${filterCount} filters on`}
                </ThemedText>
                <Button compact variant="ghost" label="Clear filters" onPress={clearFilters} />
              </View>
            ) : null}

            {trips.length > 0 ? (
              <StatusText
                message={
                  searching
                    ? `${countTrips(visible.length)} bought “${normalizeText(filter.query)}”, ${describeRange(filter.range, now)}`
                    : `${countTrips(visible.length)}, ${describeRange(filter.range, now)}`
                }
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          trips.length === 0 ? (
            <EmptyState
              title="No trips yet"
              message="When you finish a shopping trip, it's listed here with the store and the date."
            />
          ) : (
            <View style={styles.noMatches}>
              <EmptyState
                title="No matching trips"
                message={searching ? 'Try a different search, other dates, or fewer stores.' : 'Try other dates, or fewer stores.'}
              />
              <Button
                variant="secondary"
                label="Clear search and filters"
                onPress={() => setFilter(EMPTY_TRIP_FILTER)}
              />
            </View>
          )
        }
        renderItem={({ item: trip }) => (
          <Card
            title={trip.storeName}
            subtitle={trip.storeLocation}
            detail={formatTripDate(trip.finishedAt)}
            spokenDetail={formatTripDateSpoken(trip.finishedAt)}
            accessibilityHint="Shows the items bought on this trip"
            onPress={() => router.push({ pathname: '/trip/history/[id]', params: { id: trip.id } })}
          />
        )}
      />
    </ThemedView>
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  noMatches: { gap: Spacing.three },
  separator: { height: Spacing.two },
});
