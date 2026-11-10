import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FilterButton } from '@/components/filter-button';
import { FilterPanel } from '@/components/filter-panel';
import { MasterItemRow } from '@/components/master-item-row';
import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { setChecked, setQuantity } from '@/data/list-repo';
import { useDatabase } from '@/db/database-provider';
import { describeLocations } from '@/domain/describe';
import { describeLastBought } from '@/domain/last-bought';
import {
  activeFilterCount,
  applyItemFilter,
  EMPTY_FILTER,
  getFilterOptions,
  hasSearchOrFilters,
  pruneFilter,
} from '@/domain/item-filter';
import { sortItems, type ItemSortChoice } from '@/domain/item-sort';
import type { Item } from '@/domain/types';
import { useItemSortChoice, useItems, useListEntries, useStores } from '@/hooks/use-data';

/** A department heading or an item, when the list is grouped by department. */
type Row = { type: 'heading'; key: string; title: string } | { type: 'item'; key: string; item: Item };

/**
 * The master list: every item, searchable, filterable and sortable, with a checkbox and
 * per-check quantity.
 */
export default function MasterListScreen() {
  const db = useDatabase();
  const items = useItems();
  const stores = useStores();
  const entries = useListEntries();
  const [rawFilter, setFilter] = useState(EMPTY_FILTER);
  const defaultSort = useItemSortChoice();
  /**
   * A sort chosen here, and the default it replaced. It only applies while that's still the
   * default: choosing a new default in Settings shows the list that way.
   */
  const [chosenSort, setChosenSort] = useState<ItemSortChoice & { over: ItemSortChoice }>();
  /**
   * Quantity text as typed, by item id. Every row for an item (it can appear under several
   * departments) shows this, so the copies stay in step keystroke by keystroke. The saved value
   * is tidied up (trimmed), so it can't drive the field directly while typing.
   */
  const [typedQuantities, setTypedQuantities] = useState<Record<string, string>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  // For "Last bought today": refreshed whenever the tab is shown, so it stays right across days.
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  if (!items || !stores || !entries || !defaultSort) return null;

  const { sort, direction } =
    chosenSort?.over.sort === defaultSort.sort && chosenSort.over.direction === defaultSort.direction
      ? chosenSort
      : defaultSort;
  const chooseSort = (choice: Partial<ItemSortChoice>) =>
    setChosenSort({ sort, direction, ...choice, over: defaultSort });

  const options = getFilterOptions(items, stores);
  // Ignore selections for stores, departments or brands that have since been deleted.
  const filter = pruneFilter(rawFilter, options);
  const filterCount = activeFilterCount(filter);
  const narrowed = hasSearchOrFilters(filter);
  const visible = applyItemFilter(items, stores, entries, filter);
  const rows: Row[] = sortItems(visible, stores, sort, direction, filter).flatMap((group) => [
    ...(group.title === null ? [] : [{ type: 'heading' as const, key: `heading:${group.key}`, title: group.title }]),
    // An item can be in several groups, so its row key includes the group.
    ...group.items.map((item) => ({ type: 'item' as const, key: `${group.key}:${item.id}`, item })),
  ]);

  const toggleChecked = (itemId: string) => {
    // Unchecking discards the quantity, so re-checking starts blank.
    setTypedQuantities(({ [itemId]: _discard, ...rest }) => rest);
    void setChecked(db, itemId, !entries[itemId]);
  };

  const changeQuantity = (itemId: string, quantity: string) => {
    setTypedQuantities((typed) => ({ ...typed, [itemId]: quantity }));
    void setQuantity(db, itemId, quantity);
  };

  const clearFilters = () => setFilter({ ...EMPTY_FILTER, query: filter.query });

  return (
    <ThemedView style={styles.flex} testID="master-list">
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchRow}>
              <SearchField
                label="Search items"
                placeholder="Search items"
                value={filter.query}
                onChangeText={(query) => setFilter({ ...filter, query })}
              />
              <FilterButton
                count={filterCount}
                sort={sort}
                direction={direction}
                defaultChoice={defaultSort}
                expanded={panelOpen}
                onPress={() => setPanelOpen(!panelOpen)}
              />
            </View>

            {panelOpen ? (
              <FilterPanel
                options={options}
                filter={filter}
                onChange={setFilter}
                sort={sort}
                direction={direction}
                onChangeSort={(next) => chooseSort({ sort: next })}
                onChangeDirection={(next) => chooseSort({ direction: next })}
              />
            ) : null}

            {filterCount > 0 ? (
              <View style={styles.summary}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {filterCount === 1 ? '1 filter on' : `${filterCount} filters on`}
                </ThemedText>
                <Button compact variant="ghost" label="Clear filters" onPress={clearFilters} />
              </View>
            ) : null}

            {narrowed && items.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
                Showing {visible.length} of {items.length} items
              </ThemedText>
            ) : null}

            <Button label="Add an item" onPress={() => router.push('/items/form')} />
          </View>
        }
        ListEmptyComponent={
          items.length === 0 ? (
            <EmptyState title="No items yet" message="Add something you buy often, like milk or bananas." />
          ) : (
            <View style={styles.noMatches}>
              <EmptyState title="No matching items" message="Try a different search, or fewer filters." />
              <Button variant="secondary" label="Clear search and filters" onPress={() => setFilter(EMPTY_FILTER)} />
            </View>
          )
        }
        renderItem={({ item: row }) =>
          row.type === 'heading' ? (
            <ThemedText type="smallBold" accessibilityRole="header" style={styles.heading}>
              {row.title}
            </ThemedText>
          ) : (
            <MasterItemRow
              item={row.item}
              whereToFind={describeLocations(row.item, stores)}
              lastBought={row.item.lastBoughtAt ? describeLastBought(row.item.lastBoughtAt, now) : undefined}
              entry={entries[row.item.id]}
              quantity={typedQuantities[row.item.id] ?? entries[row.item.id]?.quantity ?? ''}
              onToggle={() => toggleChecked(row.item.id)}
              onQuantityChange={(quantity) => changeQuantity(row.item.id, quantity)}
              onOpen={() => router.push({ pathname: '/items/form', params: { id: row.item.id } })}
            />
          )
        }
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
  heading: { marginTop: Spacing.two },
});
