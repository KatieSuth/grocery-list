import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { StartupError } from '@/components/startup-error';
import { DatabaseProvider } from '@/db/database-provider';
import { useSetupComplete } from '@/hooks/use-data';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DatabaseProvider fallback={(error) => (error ? <StartupError error={error} /> : null)}>
        <RootNavigator />
      </DatabaseProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const setupComplete = useSetupComplete();

  useEffect(() => {
    if (setupComplete !== undefined) {
      void SplashScreen.hideAsync();
    }
  }, [setupComplete]);

  // Keep the splash screen up until we know which flow to show.
  if (setupComplete === undefined) return null;

  return (
    <Stack>
      {/* First-run onboarding. Once finished, its history is dropped and the main app shows. */}
      <Stack.Protected guard={!setupComplete}>
        <Stack.Screen name="setup" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={setupComplete}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
