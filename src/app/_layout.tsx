import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AppearanceProvider } from '@/components/appearance-provider';
import { StartupError } from '@/components/startup-error';
import { DatabaseProvider } from '@/db/database-provider';
import { useSetupComplete } from '@/hooks/use-data';
import { formTitle, ITEM_FORM_TITLES, STORE_FORM_TITLES } from '@/utils/form-title';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    // Gesture Handler's root view is required for drag-to-reorder (react-native-sortables).
    <GestureHandlerRootView style={styles.root}>
      {/* Tracks the keyboard so screens can keep the focused field above it (see Screen).
          The app always draws edge-to-edge, but Expo Go doesn't report that, so say so here;
          otherwise the provider adds margins for the system bars on top of the screens' own
          insets (e.g. a gap under the tab bar). */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <DatabaseProvider fallback={(error) => (error ? <StartupError error={error} /> : null)}>
          {/* The light/dark choice is saved in the database. */}
          <AppearanceProvider>
            <RootNavigator />
          </AppearanceProvider>
        </DatabaseProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
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
        {/* Forms cover the tab bar, so they can't be left open on one tab while changing data on
            another: leaving one means closing it (and being asked first if it has unsaved changes). */}
        <Stack.Screen name="item-form" options={formTitle(ITEM_FORM_TITLES)} />
        <Stack.Screen name="store-form" options={formTitle(STORE_FORM_TITLES)} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
