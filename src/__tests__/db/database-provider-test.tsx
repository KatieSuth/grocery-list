import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { AppDatabase } from '@/db/database';
import { DatabaseProvider, useDatabase } from '@/db/database-provider';

function ShowName() {
  return <Text>{useDatabase().name}</Text>;
}

const fakeDb = { name: 'fake' } as AppDatabase;

test('shows the fallback until the database is ready', async () => {
  let resolve!: (db: AppDatabase) => void;
  const load = () => new Promise<AppDatabase>((r) => (resolve = r));
  await render(
    <DatabaseProvider load={load} fallback={() => <Text>Loading</Text>}>
      <ShowName />
    </DatabaseProvider>,
  );
  expect(screen.getByText('Loading')).toBeOnTheScreen();
  resolve(fakeDb);
  expect(await screen.findByText('fake')).toBeOnTheScreen();
});

test('renders nothing while loading when there is no fallback', async () => {
  await render(
    <DatabaseProvider load={() => new Promise(() => {})}>
      <ShowName />
    </DatabaseProvider>,
  );
  expect(screen.toJSON()).toBeNull();
});

test('passes load errors to the fallback, wrapping non-Errors', async () => {
  await render(
    <DatabaseProvider load={() => Promise.reject('boom')} fallback={(e) => <Text>{e ? `Error: ${e.message}` : 'Loading'}</Text>}>
      <ShowName />
    </DatabaseProvider>,
  );
  expect(await screen.findByText('Error: boom')).toBeOnTheScreen();
});

test('ignores results that arrive after unmount', async () => {
  let resolve!: (db: AppDatabase) => void;
  let reject!: (e: Error) => void;
  const ok = await render(
    <DatabaseProvider load={() => new Promise((r) => (resolve = r))}>
      <ShowName />
    </DatabaseProvider>,
  );
  await ok.unmount();
  resolve(fakeDb);

  const failing = await render(
    <DatabaseProvider load={() => new Promise((_, r) => (reject = r))}>
      <ShowName />
    </DatabaseProvider>,
  );
  await failing.unmount();
  reject(new Error('late'));
  await Promise.resolve();
});

test('useDatabase outside a provider throws a helpful error', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(render(<ShowName />)).rejects.toThrow('useDatabase must be used inside a <DatabaseProvider>.');
});
