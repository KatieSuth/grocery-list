import { normalizeQuantity, QUANTITY_MAX_LENGTH } from '@/domain/quantity';

test.each([
  ['4', '4'],
  ['  1   pint ', '1 pint'],
  ['1/2 pound', '1/2 pound'],
  ['', undefined],
  ['   ', undefined],
])('normalizeQuantity(%p) is %p', (input, expected) => {
  expect(normalizeQuantity(input)).toBe(expected);
});

test('quantities are capped in length', () => {
  expect(normalizeQuantity('x'.repeat(100))).toHaveLength(QUANTITY_MAX_LENGTH);
});
