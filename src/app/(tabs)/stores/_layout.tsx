import { Stack } from 'expo-router';

import { formTitle, STORE_FORM_TITLES } from '@/utils/form-title';

export default function StoresLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Stores' }} />
      <Stack.Screen name="form" options={formTitle(STORE_FORM_TITLES)} />
    </Stack>
  );
}
