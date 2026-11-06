import { firstValueFrom } from 'rxjs';

import { observeSetupComplete, setSetupComplete } from '@/data/settings-repo';
import { closeTestDatabases, createTestDatabase } from '@/test-utils/db';

afterEach(closeTestDatabases);

test('setup is incomplete on a fresh install and can be toggled', async () => {
  const db = await createTestDatabase();
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(false);
  await setSetupComplete(db, true);
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(true);
  await setSetupComplete(db, false);
  expect(await firstValueFrom(observeSetupComplete(db))).toBe(false);
});
