import { formTitle, ITEM_FORM_TITLES, STORE_FORM_TITLES } from '@/utils/form-title';

test('form titles depend on whether an id is present', () => {
  const store = formTitle(STORE_FORM_TITLES);
  expect(store({ route: {} }).title).toBe('Add a store');
  expect(store({ route: { params: {} } }).title).toBe('Add a store');
  expect(store({ route: { params: { id: '' } } }).title).toBe('Add a store');
  expect(store({ route: { params: { id: 's1' } } }).title).toBe('Edit store');
  expect(formTitle(ITEM_FORM_TITLES)({ route: { params: { id: 'i1' } } }).title).toBe('Edit item');
  expect(formTitle(ITEM_FORM_TITLES)({ route: {} }).title).toBe('Add an item');
});
