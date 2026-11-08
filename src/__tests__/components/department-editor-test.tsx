import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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

// Building many draggable rows is slow, so the form opens first and the list follows a moment
// later, with a spinner in its place until then.
test('the department list is built just after the rest of the form', async () => {
  const departments = Array.from({ length: 18 }, (_, i) => ({ id: `d${i}`, name: `Aisle ${i + 1}` }));

  // The first, quick render: the form without the list.
  const realUseDeferredValue = React.useDeferredValue;
  const deferred = jest.spyOn(React, 'useDeferredValue').mockImplementation((value, initial) => {
    realUseDeferredValue(value, initial); // keep React's hook order
    return initial;
  });
  const { rerender } = await render(<DepartmentEditor departments={departments} onChange={jest.fn()} knownStores={[]} />);
  expect(screen.getByLabelText('Loading departments')).toBeOnTheScreen();
  expect(screen.queryByText('Aisle 1')).toBeNull();
  expect(screen.getByLabelText('New department')).toBeOnTheScreen();

  // The render right after: the full list.
  deferred.mockRestore();
  await rerender(<DepartmentEditor departments={departments} onChange={jest.fn()} knownStores={[]} />);
  expect(screen.queryByLabelText('Loading departments')).toBeNull();
  expect(screen.getByText('Aisle 18')).toBeOnTheScreen();
});
