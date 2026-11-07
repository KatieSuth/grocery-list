import { render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Screen } from '@/components/screen';

// Stand-in that shows which content the keyboard-aware scroll view wraps, and its offset.
jest.mock('react-native-keyboard-controller', () => {
  const React = jest.requireActual('react');
  const { Text: RNText, View } = jest.requireActual('react-native');
  return {
    KeyboardAwareScrollView: ({ bottomOffset, children }: { bottomOffset: number; children: unknown }) =>
      React.createElement(
        View,
        { testID: 'keyboard-aware' },
        React.createElement(RNText, null, `bottomOffset:${bottomOffset}`),
        children
      ),
  };
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
