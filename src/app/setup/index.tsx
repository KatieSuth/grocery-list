import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Reassurance } from '@/components/reassurance';
import { Screen } from '@/components/screen';
import { StoreList } from '@/components/store-list';
import { ThemedText } from '@/components/themed-text';
import { setSetupComplete } from '@/data/settings-repo';
import { useDatabase } from '@/db/database-provider';
import { useStores } from '@/hooks/use-data';

export default function StoresSetupScreen() {
  const db = useDatabase();
  const stores = useStores();
  if (!stores) return null;

  const hasStores = stores.length > 0;

  return (
    <Screen
      footer={
        hasStores ? (
          <Button label="Next" onPress={() => router.push('/setup/items')} />
        ) : (
          <Button variant="secondary" label="Skip for now" onPress={() => void setSetupComplete(db, true)} />
        )
      }>
      <ThemedText type="subtitle">Where do you shop?</ThemedText>
      <ThemedText themeColor="textSecondary">
        Add the stores you go to, and the order you walk through their departments.
      </ThemedText>

      <StoreList
        stores={stores}
        onSelect={(store) => router.push({ pathname: '/setup/store-form', params: { id: store.id } })}
      />

      <Button variant="secondary" label="Add a store" onPress={() => router.push('/setup/store-form')} />
      {hasStores ? null : <Reassurance />}
    </Screen>
  );
}
