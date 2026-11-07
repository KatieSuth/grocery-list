import { createContext } from 'react';

/**
 * Set by `Screen`. The focused field calls it with the height of anything shown under it that
 * should stay above the keyboard too (e.g. its error message), and with 0 when that goes away.
 */
export const SpaceBelowFocusedFieldContext = createContext<(height: number) => void>(() => {});
