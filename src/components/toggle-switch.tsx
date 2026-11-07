import { Switch, type SwitchProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * An on/off switch in the app's colors. Both track colors are set: with only `true`, web draws no
 * track when off, just the thumb. iOS and Android keep their own thumb (the web version sets one).
 */
export function ToggleSwitch(props: Omit<SwitchProps, 'trackColor'>) {
  const theme = useTheme();
  return <Switch trackColor={{ false: theme.switchTrackOff, true: theme.tint }} {...props} />;
}
