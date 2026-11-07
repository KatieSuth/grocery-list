import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { ColorSchemeChoiceContext } from '@/hooks/color-scheme-choice';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColorSchemeChoice } from '@/hooks/use-data';
import { applyColorScheme } from '@/utils/apply-color-scheme';

/**
 * Applies the light/dark choice saved in Settings to everything inside. Renders nothing until the
 * choice has loaded, so the app never flashes the wrong colors (the splash screen is still up).
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const choice = useColorSchemeChoice();

  useEffect(() => {
    if (choice) applyColorScheme(choice);
  }, [choice]);

  if (!choice) return null;
  return (
    <ColorSchemeChoiceContext value={choice}>
      <NavigationTheme>{children}</NavigationTheme>
    </ColorSchemeChoiceContext>
  );
}

/** Headers and other navigation chrome. */
function NavigationTheme({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>{children}</ThemeProvider>;
}
