import { forgetChangeEvents } from '@/db/change-events';

function fakeStorage(entries: Record<string, string>) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (key: string) => void data.delete(key),
  };
}

test("forgets only this database's change events", () => {
  const storage = fakeStorage({
    'RxDB-ls-changes-grocerylist--stores--0': '{"old":"Corner Market"}',
    'RxDB-ls-changes-grocerylist--items--1': '{"old":"Milk"}',
    'RxDB-ls-docs-grocerylist--settings--2-app': '{}',
    'RxDB-ls-changes-other--stores--0': '{}',
  });
  forgetChangeEvents('grocerylist', storage);
  expect([...storage.data.keys()]).toEqual([
    'RxDB-ls-docs-grocerylist--settings--2-app',
    'RxDB-ls-changes-other--stores--0',
  ]);
});

test('does nothing without localStorage', () => {
  expect(() => forgetChangeEvents('grocerylist', undefined)).not.toThrow();
});
