import { router } from 'expo-router';
import { FlatList, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { MasterItemRow } from '@/components/master-item-row';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { setChecked, setQuantity } from '@/data/list-repo';
import { useDatabase } from '@/db/database-provider';
import { describeLocations } from '@/domain/describe';
import { useItems, useListEntries, useStores } from '@/hooks/use-data';

/** The master list: every item, with a checkbox and an optional per-check quantity. */
export default function MasterListScreen() {
  const db = useDatabase();
  const items = useItems();
  const stores = useStores();
  const entries = useListEntries();
  if (!items || !stores || !entries) return null;

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button variant="secondary" label="Add an item" onPress={() => router.push('/items/form')} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="No items yet" message="Add something you buy often, like milk or bananas." />
        }
        renderItem={({ item }) => (
          <MasterItemRow
            item={item}
            whereToFind={describeLocations(item, stores)}
            entry={entries[item.id]}
            onToggle={() => void setChecked(db, item.id, !entries[item.id])}
            onQuantityChange={(quantity) => void setQuantity(db, item.id, quantity)}
            onOpen={() => router.push({ pathname: '/items/form', params: { id: item.id } })}
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
  header: { marginBottom: Spacing.three },
  separator: { height: Spacing.two },
});
