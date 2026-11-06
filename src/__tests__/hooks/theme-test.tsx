import { renderHook } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme as useWebColorScheme } from '@/hooks/use-color-scheme.web';
import { useTheme } from '@/hooks/use-theme';

afterEach(() => jest.restoreAllMocks());

test.each([
  ['light', Colors.light],
  ['dark', Colors.dark],
  ['unspecified', Colors.light],
] as const)('useTheme for a %s system scheme', async (scheme, colors) => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
  const { result } = await renderHook(() => useTheme());
  expect(result.current).toBe(colors);
});

test('the web color scheme hook reports the system scheme on the client', async () => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
  const { result } = await renderHook(() => useWebColorScheme());
  expect(result.current).toBe('dark');
});

test('the web color scheme hook reports light during static rendering', () => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
  const { renderToString } = jest.requireActual('react-dom/server');
  function Probe() {
    return <>{useWebColorScheme()}</>;
  }
  expect(renderToString(<Probe />)).toContain('light');
});
