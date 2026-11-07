import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text, TextInput } from 'react-native';
import type Animated from 'react-native-reanimated';
import type { AnimatedRef } from 'react-native-reanimated';

import { Screen } from '@/components/screen';

const mockAssureFocusedInputVisible = jest.fn();

// Stand-in that shows which content the keyboard-aware scroll view wraps, and its offset.
jest.mock('react-native-keyboard-controller', () => {
  const React = jest.requireActual('react');
  const { Text: RNText, View } = jest.requireActual('react-native');
  return {
    KeyboardAwareScrollView: ({
      ref,
      bottomOffset,
      onContentSizeChange,
      children,
    }: {
      ref: (instance: object | null) => void;
      bottomOffset: number;
      onContentSizeChange: () => void;
      children: unknown;
    }) => {
      React.useImperativeHandle(ref, () => ({ assureFocusedInputVisible: mockAssureFocusedInputVisible }));
      return React.createElement(
        View,
        { testID: 'keyboard-aware', onContentSizeChange },
        React.createElement(RNText, null, `bottomOffset:${bottomOffset}`),
        children
      );
    },
  };
});

afterEach(() => jest.restoreAllMocks());

// When the keyboard opens, the content scrolls up with it so the focused field stays visible
// (e.g. "New department" on the store form). The Cancel/Save footer stays behind the keyboard.
test('the content moves up with the keyboard; the footer does not', async () => {
  await render(
    <Screen footer={<Text>Save</Text>}>
      <Text>New department</Text>
    </Screen>
  );
  const keyboardAware = screen.getByTestId('keyboard-aware');
  expect(within(keyboardAware).getByText('New department')).toBeOnTheScreen();
  expect(within(keyboardAware).queryByText('Save')).toBeNull();
  expect(screen.getByText('Save')).toBeOnTheScreen();
  // A little space between the focused field and the top of the keyboard.
  expect(within(keyboardAware).getByText('bottomOffset:16')).toBeOnTheScreen();
});

test('when content grows and pushes the focused field down, it is scrolled back above the keyboard', async () => {
  await render(
    <Screen>
      <Text>Departments</Text>
    </Screen>
  );
  mockAssureFocusedInputVisible.mockClear();

  // Nothing focused (no keyboard): growing content doesn't scroll.
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(null as never);
  await fireEvent(screen.getByTestId('keyboard-aware'), 'contentSizeChange', 0, 800);
  expect(mockAssureFocusedInputVisible).not.toHaveBeenCalled();

  // Typing in a field, e.g. after adding a department.
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({} as never);
  await fireEvent(screen.getByTestId('keyboard-aware'), 'contentSizeChange', 0, 900);
  expect(mockAssureFocusedInputVisible).toHaveBeenCalledTimes(1);
});

test('drag-to-reorder gets the scroll view through scrollRef', async () => {
  const scrollView = expect.objectContaining({ assureFocusedInputVisible: mockAssureFocusedInputVisible });

  // Reanimated's animated refs are callable.
  const callableRef = jest.fn() as unknown as AnimatedRef<Animated.ScrollView>;
  await render(
    <Screen scrollRef={callableRef}>
      <Text>Departments</Text>
    </Screen>
  );
  expect(callableRef).toHaveBeenCalledWith(scrollView);
  await screen.unmount();

  // Reanimated's Jest mock returns a plain ref object.
  const objectRef = { current: null } as unknown as AnimatedRef<Animated.ScrollView>;
  await render(
    <Screen scrollRef={objectRef}>
      <Text>Departments</Text>
    </Screen>
  );
  expect(objectRef.current).toEqual(scrollView);
});
