import { notify } from '@/utils/notify';

export const WRITE_FAILED_TITLE = 'Something went wrong';

/**
 * Starts a database write without waiting for it, for taps that update the screen through the
 * database (checking an item, a setting). If the write fails, the user is told instead of the
 * tap silently doing nothing.
 */
export function runWrite(write: () => Promise<unknown>, failure: string): void {
  write().catch(() => notify(WRITE_FAILED_TITLE, failure));
}
