import { fireEvent, render, screen } from '@testing-library/react-native';

import { SwitchRow } from '@/components/switch-row';

test('the row is one switch for screen readers, announced with its label and description', async () => {
  await render(<SwitchRow label="Needed" description="Check it on your list." value onValueChange={jest.fn()} />);
  const row = screen.getByRole('switch', { name: 'Needed' });
  expect(row).toBeChecked();
  expect(row).toHaveProp('accessibilityHint', 'Check it on your list.');
  // The switch inside only shows the state, so it isn't a second control to screen readers.
  expect(screen.getAllByRole('switch')).toEqual([row]);
});

test('tapping anywhere on the row toggles it, and so does the switch itself', async () => {
  const onValueChange = jest.fn();
  await render(<SwitchRow label="Reverse order" value={false} onValueChange={onValueChange} accessibilityHint="Walk it backwards" />);
  const row = screen.getByRole('switch', { name: 'Reverse order' });
  expect(row).not.toBeChecked();
  expect(row).toHaveProp('accessibilityHint', 'Walk it backwards');

  await fireEvent.press(row);
  expect(onValueChange).toHaveBeenLastCalledWith(true);

  await fireEvent(screen.getByTestId('switch-row-toggle', { includeHiddenElements: true }), 'valueChange', true);
  expect(onValueChange).toHaveBeenCalledTimes(2);
});
