import { Stack } from 'expo-router';

import { HistoryButton } from '@/components/history-button';

export default function TripLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Shopping trip', headerRight: () => <HistoryButton /> }} />
      <Stack.Screen name="history/index" options={{ title: 'Trip history' }} />
      <Stack.Screen name="history/[id]" options={{ title: 'Trip' }} />
    </Stack>
  );
}
