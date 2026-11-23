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

test('the store form is titled Copy store when copying', () => {
  const store = formTitle(STORE_FORM_TITLES);
  expect(store({ route: { params: { copyFrom: 's1' } } }).title).toBe('Copy store');
  expect(store({ route: { params: { copyFrom: '' } } }).title).toBe('Add a store');
  // Forms without a copy title ignore the param.
  expect(formTitle(ITEM_FORM_TITLES)({ route: { params: { copyFrom: 'i1' } } }).title).toBe('Add an item');
});
