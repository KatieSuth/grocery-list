import { fireEvent, render, screen } from '@testing-library/react-native';

import { SpaceBelowFocusedFieldContext } from '@/components/space-below-focused-field';
import { TextField } from '@/components/text-field';

const reportSpaceBelow = jest.fn();

function renderField(error?: string, handlers: { onFocus?: () => void; onBlur?: () => void } = {}) {
  return (
    <SpaceBelowFocusedFieldContext value={reportSpaceBelow}>
      <TextField label="New department" error={error} {...handlers} />
    </SpaceBelowFocusedFieldContext>
  );
}

const errorLayout = { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 20 } } };

beforeEach(() => reportSpaceBelow.mockClear());

// So the screen keeps the error message above the keyboard along with the field.
test('while focused, a field reports the room its error message needs below it', async () => {
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  const { rerender } = await render(renderField(undefined, { onFocus, onBlur }));
  const input = screen.getByLabelText('New department');

  // Focused, no error: nothing extra.
  await fireEvent(input, 'focus');
  expect(onFocus).toHaveBeenCalled();
  expect(reportSpaceBelow).not.toHaveBeenCalled();

  // The error appears and is laid out: its height plus the gap above it.
  await rerender(renderField('"Deli" is already in the list.', { onFocus, onBlur }));
  await fireEvent(screen.getByText('"Deli" is already in the list.').parent!, 'layout', errorLayout);
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(24);

  // Leaving the field clears it.
  await fireEvent(input, 'blur');
  expect(onBlur).toHaveBeenCalled();
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(0);
});

test('fixing the error clears the room it needed', async () => {
  const { rerender } = await render(renderField('"Deli" is already in the list.'));
  await fireEvent(screen.getByLabelText('New department'), 'focus');
  await fireEvent(screen.getByText('"Deli" is already in the list.').parent!, 'layout', errorLayout);
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(24);

  await rerender(renderField(undefined));
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(0);
});

test('an unfocused field with an error needs no extra room', async () => {
  await render(renderField('"Deli" is already in the list.'));
  await fireEvent(screen.getByText('"Deli" is already in the list.').parent!, 'layout', errorLayout);
  expect(reportSpaceBelow).not.toHaveBeenCalled();
});

test('outside a Screen, a focused field with an error still works', async () => {
  await render(<TextField label="Store name" error="Enter a name." />);
  await fireEvent(screen.getByLabelText('Store name'), 'focus');
  await fireEvent(screen.getByText('Enter a name.').parent!, 'layout', errorLayout);
  expect(screen.getByText('Enter a name.')).toBeOnTheScreen();
  expect(reportSpaceBelow).not.toHaveBeenCalled();
});

// e.g. autofill suggestions under the field, which need to stay above the keyboard to be tapped.
test('while focused, a field also reports the room for content shown below it', async () => {
  const field = (extra: number, error?: string) => (
    <SpaceBelowFocusedFieldContext value={reportSpaceBelow}>
      <TextField label="New department" error={error} extraSpaceBelow={extra} />
    </SpaceBelowFocusedFieldContext>
  );
  const { rerender } = await render(field(100));
  expect(reportSpaceBelow).not.toHaveBeenCalled();

  await fireEvent(screen.getByLabelText('New department'), 'focus');
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(100);

  // With an error too, there's room for both.
  await rerender(field(100, 'Enter a name.'));
  await fireEvent(screen.getByText('Enter a name.').parent!, 'layout', errorLayout);
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(124);

  await rerender(field(0));
  expect(reportSpaceBelow).toHaveBeenLastCalledWith(0);
});
