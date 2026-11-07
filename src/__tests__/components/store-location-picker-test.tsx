import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { StoreLocationPicker } from '@/components/store-location-picker';

const stores = [
  { id: 's1', name: 'Corner Market', departments: [{ id: 'd1', name: 'Deli' }], createdAt: 1 },
  { id: 's2', name: 'Big Box', departments: [{ id: 'd2', name: 'Frozen' }], createdAt: 2 },
];

afterEach(() => jest.restoreAllMocks());

// Typing the item name leaves the keyboard up; choosing where to find it closes it, so the
// keyboard doesn't cover the departments (and the form doesn't jump back to the name field).
test('choosing a store or a department closes the keyboard', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const onToggleStore = jest.fn();
  const onChooseDepartment = jest.fn();
  await render(
    <StoreLocationPicker
      stores={stores}
      selections={{ s1: null }}
      onToggleStore={onToggleStore}
      onChooseDepartment={onChooseDepartment}
    />
  );

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Big Box' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(onToggleStore).toHaveBeenCalledWith('s2');

  await fireEvent.press(screen.getByRole('radio', { name: 'Deli in Corner Market' }));
  expect(dismiss).toHaveBeenCalledTimes(2);
  expect(onChooseDepartment).toHaveBeenCalledWith('s1', 'd1');
});
