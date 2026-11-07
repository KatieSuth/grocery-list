import type { ComponentType } from 'react';
import { Switch, type SwitchProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** React Native Web's Switch also takes the thumb color when on, which otherwise is teal. */
const WebSwitch = Switch as ComponentType<SwitchProps & { activeThumbColor?: string }>;

/** The thumb color on iOS. React Native Web's default thumb when off is this too. */
export const THUMB_COLOR = '#FAFAFA';

/** Web version: as on iOS, the thumb stays white when on, instead of React Native Web's teal. */
export function ToggleSwitch(props: Omit<SwitchProps, 'trackColor'>) {
  const theme = useTheme();
  return (
    <WebSwitch
      trackColor={{ false: theme.switchTrackOff, true: theme.tint }}
      thumbColor={THUMB_COLOR}
      activeThumbColor={THUMB_COLOR}
      {...props}
    />
  );
}
