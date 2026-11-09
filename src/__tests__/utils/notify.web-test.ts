import { notify } from '@/utils/notify';

test('on web, messages use the browser’s alert', () => {
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  notify('Imported', 'Added 1 new item.');
  expect(alert).toHaveBeenCalledWith('Imported\n\nAdded 1 new item.');
});
