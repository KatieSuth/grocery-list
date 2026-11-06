import { map, type Observable } from 'rxjs';

import type { AppDatabase } from '@/db/database';
import { SETTINGS_ID } from '@/db/schema';

export function observeSetupComplete(db: AppDatabase): Observable<boolean> {
  return db.settings.findOne(SETTINGS_ID).$.pipe(map((doc) => doc?.setupComplete ?? false));
}

export async function setSetupComplete(db: AppDatabase, setupComplete: boolean): Promise<void> {
  await db.settings.upsert({ id: SETTINGS_ID, setupComplete });
}
