import { focusedTextInput } from '@/utils/focused-input';

// Browsers keep the focused field above the on-screen keyboard, so screens never scroll it.
test('on web, screens never need to bring the focused field back into view', () => {
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  expect(focusedTextInput()).toBeNull();
  input.remove();
});
