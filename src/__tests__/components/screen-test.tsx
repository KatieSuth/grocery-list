import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { use } from 'react';
import { Text, TextInput } from 'react-native';
import type Animated from 'react-native-reanimated';
import type { AnimatedRef } from 'react-native-reanimated';

import { Screen } from '@/components/screen';
import { SpaceBelowFocusedFieldContext } from '@/components/space-below-focused-field';

const mockAssureFocusedInputVisible = jest.fn();

// Where things are on screen. The screen's top edge is at 100; tests place the focused field.
const SCREEN_TOP = 100;
const focusedField = { name: 'focused field' };
let mockFieldTop = 300;
jest.mock('@/utils/measure', () => ({
  measureTopInWindow: (view: object) => Promise.resolve(view === focusedField ? mockFieldTop : SCREEN_TOP),
}));

/** Pretends `field` has focus (the keyboard is up), or nothing does. */
const focus = (field: object | null) =>
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(field as never);

/** Grows the content and lets the position checks finish. */
async function growContent(height: number) {
  await fireEvent(screen.getByTestId('keyboard-aware'), 'contentSizeChange', 0, height);
  await act(async () => {});
}

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

afterEach(() => {
  jest.restoreAllMocks();
  mockAssureFocusedInputVisible.mockClear();
  mockFieldTop = 300;
});

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
  focus(null);
  await growContent(800);
  expect(mockAssureFocusedInputVisible).not.toHaveBeenCalled();

  // Typing in a field that's on screen, e.g. after adding a department.
  focus(focusedField);
  await growContent(900);
  expect(mockAssureFocusedInputVisible).toHaveBeenCalledTimes(1);
});

test('after scrolling past the focused field, growing content does not scroll back up to it', async () => {
  await render(
    <Screen>
      <Text>Where to find it</Text>
    </Screen>
  );
  mockAssureFocusedInputVisible.mockClear();

  // The item name still has focus, but the user scrolled down past it to the stores.
  focus(focusedField);
  mockFieldTop = SCREEN_TOP - 50;
  await growContent(1200);
  expect(mockAssureFocusedInputVisible).not.toHaveBeenCalled();
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

test('an error shown under the focused field is kept above the keyboard too', async () => {
  let reportSpaceBelow: (height: number) => void = () => {};
  function Field() {
    reportSpaceBelow = use(SpaceBelowFocusedFieldContext);
    return <Text>New department</Text>;
  }
  await render(
    <Screen>
      <Field />
    </Screen>
  );
  focus(focusedField);
  mockAssureFocusedInputVisible.mockClear();

  // "already in the list" appears under the field: keep 24 more points clear, and scroll again.
  await act(async () => reportSpaceBelow(24));
  await act(async () => {});
  expect(screen.getByText('bottomOffset:40')).toBeOnTheScreen();
  expect(mockAssureFocusedInputVisible).toHaveBeenCalledTimes(1);

  await act(async () => reportSpaceBelow(0));
  expect(screen.getByText('bottomOffset:16')).toBeOnTheScreen();
});
