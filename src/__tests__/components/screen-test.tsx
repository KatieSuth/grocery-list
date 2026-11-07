import { render, screen } from '@testing-library/react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { Text } from 'react-native';

import { Screen } from '@/components/screen';

// Stand-in that shows the keyboard settings Screen passes, as text.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = jest.requireActual('react');
  const { Text: RNText, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ behavior, keyboardVerticalOffset, children }: Record<string, unknown>) =>
      React.createElement(
        View,
        null,
        React.createElement(RNText, null, `keyboard:${behavior}:${keyboardVerticalOffset}`),
        children
      ),
  };
});

// Android apps are edge-to-edge, so the window doesn't resize for the keyboard: without a
// behavior, the keyboard covers inputs near the bottom (e.g. "New department" on the store form).
test('content moves up for the keyboard on every platform, below the navigation header', async () => {
  await render(
    <HeaderHeightContext value={64}>
      <Screen>
        <Text>Form</Text>
      </Screen>
    </HeaderHeightContext>
  );
  expect(screen.getByText('keyboard:padding:64')).toBeOnTheScreen();
  expect(screen.getByText('Form')).toBeOnTheScreen();
});

test('a screen without a navigation header needs no keyboard offset', async () => {
  await render(
    <Screen>
      <Text>Form</Text>
    </Screen>
  );
  expect(screen.getByText('keyboard:padding:0')).toBeOnTheScreen();
});
