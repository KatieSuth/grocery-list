import { render, screen } from '@testing-library/react-native';

import TabsLayout from '@/app/(tabs)/_layout';

// The native tab bar can't render in Jest; stand-ins expose what the layout passes it.
jest.mock('expo-router/native-tabs', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const NativeTabs = ({ children, tintColor }: { children: unknown; tintColor: string }) =>
    React.createElement(View, { testID: 'tabs', accessibilityHint: tintColor }, children);
  const Trigger = ({ name, children }: { name: string; children: unknown }) =>
    React.createElement(View, { testID: `tab-${name}` }, children);
  Trigger.Label = function Label({ children }: { children: string }) {
    return React.createElement(Text, null, children);
  };
  Trigger.Icon = function Icon(props: object) {
    return React.createElement(Text, null, `icon:${JSON.stringify(props)}`);
  };
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

test('four tabs in order: items (list), trip (cart), stores (storefront), settings (gear)', async () => {
  await render(<TabsLayout />);

  const tabs = screen.getByTestId('tabs');
  expect(tabs.children.map((c) => (typeof c === 'string' ? c : c.props.testID))).toEqual([
    'tab-(items)',
    'tab-trip',
    'tab-stores',
    'tab-settings',
  ]);

  expect(screen.getByText('Trip')).toBeOnTheScreen();
  expect(screen.getByText('Items')).toBeOnTheScreen();
  expect(screen.getByText('Stores')).toBeOnTheScreen();
  expect(screen.getByText('Settings')).toBeOnTheScreen();

  // SF Symbols on iOS, Material Symbols on Android.
  expect(screen.getByText(/icon:.*"sf":\{"default":"cart","selected":"cart.fill"\}.*"md":"shopping_cart"/)).toBeOnTheScreen();
  expect(screen.getByText(/icon:.*"sf":"list.bullet".*"md":"list"/)).toBeOnTheScreen();
  expect(screen.getByText(/icon:.*"sf":\{"default":"storefront".*"md":"storefront"/)).toBeOnTheScreen();
  expect(screen.getByText(/icon:.*"sf":\{"default":"gearshape","selected":"gearshape.fill"\}.*"md":"settings"/)).toBeOnTheScreen();
});
