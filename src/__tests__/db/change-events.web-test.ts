import { forgetChangeEvents } from '@/db/change-events';

test("on web, forgets this database's change events from the browser's localStorage", () => {
  localStorage.setItem('RxDB-ls-changes-grocerylist--stores--0', '{"old":"Corner Market"}');
  localStorage.setItem('RxDB-ls-docs-grocerylist--settings--2-app', '{}');
  forgetChangeEvents('grocerylist');
  expect(localStorage.getItem('RxDB-ls-changes-grocerylist--stores--0')).toBeNull();
  expect(localStorage.getItem('RxDB-ls-docs-grocerylist--settings--2-app')).toBe('{}');
});
