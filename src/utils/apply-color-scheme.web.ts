import type { ColorSchemeChoice } from '@/domain/appearance';

/**
 * Web version: React Native Web can't override the browser's scheme, so the app's own colors come
 * from ColorSchemeChoiceContext. This sets CSS color-scheme so scrollbars and form controls match.
 */
export function applyColorScheme(choice: ColorSchemeChoice): void {
  document.documentElement.style.colorScheme = choice === 'system' ? '' : choice;
}
