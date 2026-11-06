import { normalizeText } from '@/utils/text';

/** Long enough for "2 large bunches (about 1 lb)", short enough to fit on a row. */
export const QUANTITY_MAX_LENGTH = 40;

/** Cleans up a free-text quantity; returns undefined when blank. */
export function normalizeQuantity(value: string): string | undefined {
  const quantity = normalizeText(value).slice(0, QUANTITY_MAX_LENGTH);
  return quantity || undefined;
}
