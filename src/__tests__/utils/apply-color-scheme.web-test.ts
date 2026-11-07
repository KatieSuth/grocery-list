import { applyColorScheme } from '@/utils/apply-color-scheme';

test('on web, the choice sets CSS color-scheme so browser controls match', () => {
  applyColorScheme('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  applyColorScheme('light');
  expect(document.documentElement.style.colorScheme).toBe('light');
  applyColorScheme('system');
  expect(document.documentElement.style.colorScheme).toBe('');
});
