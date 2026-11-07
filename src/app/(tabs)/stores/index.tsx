import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { StoreList } from '@/components/store-list';
import { useStores } from '@/hooks/use-data';

/** Store configuration: the same stores and departments set up during onboarding. */
export default function StoresScreen() {
  const stores = useStores();
  if (!stores) return null;
  return (
    <Screen>
      <Button label="Add a store" onPress={() => router.push('/stores/form')} />
      <StoreList
        stores={stores}
        onSelect={(store) => router.push({ pathname: '/stores/form', params: { id: store.id } })}
      />
    </Screen>
  );
}
