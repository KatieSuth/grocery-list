import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function StartupError({ error }: { error: Error }) {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="smallBold">Something went wrong opening your grocery data.</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {error.message}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
});
