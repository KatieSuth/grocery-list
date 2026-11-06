import { Stack } from 'expo-router';

import { formTitle, ITEM_FORM_TITLES, STORE_FORM_TITLES } from '@/utils/form-title';

export default function SetupLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Your stores' }} />
      <Stack.Screen name="store-form" options={formTitle(STORE_FORM_TITLES)} />
      <Stack.Screen name="items" options={{ title: 'Your items' }} />
      <Stack.Screen name="item-form" options={formTitle(ITEM_FORM_TITLES)} />
    </Stack>
  );
}
