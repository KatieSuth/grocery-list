import { use, useSyncExternalStore } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { ColorSchemeChoiceContext } from './color-scheme-choice';

const subscribe = () => () => {};

/**
 * The device's light/dark setting, unless the user picked one in Settings.
 * To support static rendering, report 'light' while rendering on the server and during
 * hydration, then the real color scheme on the client.
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const choice = use(ColorSchemeChoiceContext);
  const system = useSystemColorScheme();
  if (!hydrated) return 'light';
  return choice === 'system' ? system : choice;
}
