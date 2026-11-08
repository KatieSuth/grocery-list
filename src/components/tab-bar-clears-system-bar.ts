import { createContext } from 'react';

/**
 * True inside the main app's tabs: the tab bar sits at the bottom and already clears the system
 * navigation bar (gesture area or buttons), so screens shouldn't add that space again.
 */
export const TabBarClearsSystemBarContext = createContext(false);
