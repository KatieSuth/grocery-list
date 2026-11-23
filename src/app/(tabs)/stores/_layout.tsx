import { Stack } from 'expo-router';

export default function StoresLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Stores' }} />
    </Stack>
  );
}
