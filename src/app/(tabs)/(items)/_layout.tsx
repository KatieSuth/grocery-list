import { Stack } from 'expo-router';

import { formTitle, ITEM_FORM_TITLES } from '@/utils/form-title';

export default function ItemsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Items' }} />
      <Stack.Screen name="items/form" options={formTitle(ITEM_FORM_TITLES)} />
    </Stack>
  );
}
