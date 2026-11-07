import { confirmAction, confirmDestructive } from '@/utils/confirm';

afterEach(() => jest.restoreAllMocks());

test('on web, confirms with window.confirm, including the message', () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  const onConfirm = jest.fn();
  confirmDestructive({ title: 'Delete Shop?', message: 'Gone for good.', confirmLabel: 'Delete', onConfirm });
  expect(confirm).toHaveBeenCalledWith('Delete Shop?\n\nGone for good.');
  expect(onConfirm).toHaveBeenCalled();
});

test('on web, cancelling does nothing', () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  const onConfirm = jest.fn();
  confirmDestructive({ title: 'Delete Shop?', confirmLabel: 'Delete', onConfirm });
  expect(onConfirm).not.toHaveBeenCalled();
});

test('on web, confirmAction uses the same dialog', () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  const onConfirm = jest.fn();
  confirmAction({ title: 'Finish trip?', confirmLabel: 'Finish', onConfirm });
  expect(window.confirm).toHaveBeenCalledWith('Finish trip?');
  expect(onConfirm).toHaveBeenCalled();
});
