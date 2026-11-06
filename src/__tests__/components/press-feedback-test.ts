import { pressOpacity } from '@/components/press-feedback';

test('pressOpacity', () => {
  expect(pressOpacity(false)).toBe(1);
  expect(pressOpacity(true)).toBe(0.7);
  expect(pressOpacity(true, true)).toBe(0.4);
  expect(pressOpacity(false, null)).toBe(1);
});
