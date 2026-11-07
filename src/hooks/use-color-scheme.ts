import { use } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { ColorSchemeChoiceContext } from './color-scheme-choice';

/** The device's light/dark setting, unless the user picked one in Settings. */
export function useColorScheme() {
  const choice = use(ColorSchemeChoiceContext);
  const system = useSystemColorScheme();
  return choice === 'system' ? system : choice;
}
