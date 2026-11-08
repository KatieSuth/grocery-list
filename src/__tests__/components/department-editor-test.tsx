import { fireEvent, render, screen } from '@testing-library/react-native';

import { DepartmentEditor } from '@/components/department-editor';
import { SpaceBelowFocusedFieldContext } from '@/components/space-below-focused-field';

const knownStores = [
  { id: 's1', name: 'Corner Market', departments: [{ id: 'd1', name: 'Frozen' }], createdAt: 1 },
];

const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height } } });

// The suggestions sit below the "New department" field; the screen keeps them above the
// keyboard along with the field, so they can be seen and tapped while typing.
test('suggestions while typing a new department get room above the keyboard', async () => {
  const reportSpaceBelow = jest.fn();
  await render(
    <SpaceBelowFocusedFieldContext value={reportSpaceBelow}>
      <DepartmentEditor departments={[]} onChange={jest.fn()} knownStores={knownStores} />
    </SpaceBelowFocusedFieldContext>,
  );
  const input = screen.getByLabelText('New department');
  await fireEvent(input, 'focus');
  await fireEvent.changeText(input, 'fro');

  const suggestions = screen.getByLabelText('Departments from your other stores');
  await fireEvent(suggestions, 'layout', layout(100));
  // Their height plus the gap above them.
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(108);

  // Once nothing matches, the room goes away.
  await fireEvent.changeText(input, 'xyz');
  expect(screen.queryByLabelText('Departments from your other stores')).toBeNull();
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(0);
});
