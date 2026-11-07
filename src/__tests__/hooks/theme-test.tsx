import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as ReactNative from 'react-native';

import { Colors } from '@/constants/theme';
import type { ColorSchemeChoice } from '@/domain/appearance';
import { ColorSchemeChoiceContext } from '@/hooks/color-scheme-choice';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColorScheme as useWebColorScheme } from '@/hooks/use-color-scheme.web';
import { useTheme } from '@/hooks/use-theme';
import { applyColorScheme } from '@/utils/apply-color-scheme';

afterEach(() => jest.restoreAllMocks());

const choosing = (choice: ColorSchemeChoice) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <ColorSchemeChoiceContext value={choice}>{children}</ColorSchemeChoiceContext>;
  };

test.each([
  ['light', Colors.light],
  ['dark', Colors.dark],
  ['unspecified', Colors.light],
] as const)('useTheme for a %s system scheme', async (scheme, colors) => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
  const { result } = await renderHook(() => useTheme());
  expect(result.current).toBe(colors);
});

test.each([
  ['system', 'dark', 'dark'],
  ['light', 'dark', 'light'],
  ['dark', 'light', 'dark'],
] as const)('choosing %s on a %s device shows %s', async (choice, system, shown) => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(system);
  const native = await renderHook(() => useColorScheme(), { wrapper: choosing(choice) });
  expect(native.result.current).toBe(shown);
  const web = await renderHook(() => useWebColorScheme(), { wrapper: choosing(choice) });
  expect(web.result.current).toBe(shown);
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

test('the choice is applied to native UI; following the system is "unspecified"', () => {
  const set = jest.spyOn(ReactNative.Appearance, 'setColorScheme').mockImplementation(() => {});
  applyColorScheme('dark');
  expect(set).toHaveBeenLastCalledWith('dark');
  applyColorScheme('system');
  expect(set).toHaveBeenLastCalledWith('unspecified');
});
