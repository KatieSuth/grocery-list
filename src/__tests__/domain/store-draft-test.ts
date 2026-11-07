import { emptyStoreDraft, hasErrors, storeToDraft, validateStoreDraft } from '@/domain/store-draft';

test('a new draft is empty, with no departments to start', () => {
  expect(emptyStoreDraft()).toEqual({ name: '', location: '', departments: [] });
});

test('storeToDraft copies a store without sharing department objects', () => {
  const store = { id: 's', name: 'Shop', departments: [{ id: 'd', name: 'Deli' }], createdAt: 1 };
  const draft = storeToDraft(store);
  expect(draft).toEqual({ name: 'Shop', location: '', departments: [{ id: 'd', name: 'Deli' }] });
  expect(draft.departments[0]).not.toBe(store.departments[0]);
  expect(storeToDraft({ ...store, location: 'Main' }).location).toBe('Main');
});

test('validation requires a name and at least one department', () => {
  expect(validateStoreDraft({ name: ' ', location: '', departments: [] })).toEqual({
    name: 'Store name is required.',
    departments: expect.stringContaining('at least one department'),
  });
  const ok = validateStoreDraft({ name: 'Shop', location: '', departments: [{ id: 'd', name: 'Deli' }] });
  expect(ok).toEqual({});
  expect(hasErrors(ok)).toBe(false);
  expect(hasErrors({ name: 'x' })).toBe(true);
});
