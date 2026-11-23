import type { Store } from './types';

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * The order stores are listed in everywhere: A–Z by name, then by location (ignoring case and
 * accents), with a store that has no location before those that do ("Kroger" before "Kroger,
 * Main St"). Stores that still tie keep the order they were added in.
 */
export function compareStores(a: Store, b: Store): number {
  return (
    compareText(a.name, b.name) || compareText(a.location ?? '', b.location ?? '') || a.createdAt - b.createdAt
  );
}
