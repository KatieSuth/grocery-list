import { createContext } from 'react';

import { DEFAULT_COLOR_SCHEME, type ColorSchemeChoice } from '@/domain/appearance';

/**
 * The appearance chosen in Settings. Screens shown before the database opens (such as the startup
 * error) get the default: following the device.
 */
export const ColorSchemeChoiceContext = createContext<ColorSchemeChoice>(DEFAULT_COLOR_SCHEME);
