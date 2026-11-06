import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Reassurance } from '@/components/reassurance';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { setSetupComplete } from '@/data/settings-repo';
import { useDatabase } from '@/db/database-provider';
import { describeLocations } from '@/domain/describe';
import { useItems, useStores } from '@/hooks/use-data';
import { goBack } from '@/utils/navigation';

export default function ItemsSetupScreen() {
  const db = useDatabase();
  const items = useItems();
  const stores = useStores();
  if (!items || !stores) return null;

  const hasItems = items.length > 0;
  const finish = () => void setSetupComplete(db, true);

  return (
    <Screen
      footer={
        <>
          <Button variant="secondary" label="Back" onPress={() => goBack('/setup')} />
          {hasItems ? (
            <Button label="Finish" onPress={finish} />
          ) : (
            <Button variant="secondary" label="Skip for now" onPress={finish} />
          )}
        </>
      }>
      <ThemedText type="subtitle">What do you usually buy?</ThemedText>
      <ThemedText themeColor="textSecondary">
        Add the items you pick up regularly and where to find them.
      </ThemedText>

      {hasItems ? (
        items.map((item) => (
          <Card
            key={item.id}
            title={item.name}
            subtitle={item.brand}
            detail={
              <ThemedText type="small" themeColor="textSecondary">
                {describeLocations(item, stores) || 'No store selected'}
              </ThemedText>
            }
            accessibilityHint="Edit this item"
            onPress={() => router.push({ pathname: '/setup/item-form', params: { id: item.id } })}
          />
        ))
      ) : (
        <EmptyState title="No items yet" message="Add something you buy often, like milk or bananas." />
      )}

      <Button variant="secondary" label="Add an item" onPress={() => router.push('/setup/item-form')} />
      {hasItems ? null : <Reassurance />}
    </Screen>
  );
}
