/** How the app looks: following the device's light/dark setting, or always one of them. */
export type ColorSchemeChoice = 'system' | 'light' | 'dark';

export const COLOR_SCHEME_CHOICES: readonly ColorSchemeChoice[] = ['system', 'light', 'dark'];

export const DEFAULT_COLOR_SCHEME: ColorSchemeChoice = 'system';

export const COLOR_SCHEME_LABELS: Record<ColorSchemeChoice, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

/** Spoken forms, clearer on their own than the chip labels. */
export const COLOR_SCHEME_SPOKEN: Record<ColorSchemeChoice, string> = {
  system: 'Match system appearance',
  light: 'Light mode',
  dark: 'Dark mode',
};
