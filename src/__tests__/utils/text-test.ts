import { createId } from '@/utils/id';
import { nameKey, normalizeText, sameName } from '@/utils/text';

test('normalizeText trims and collapses whitespace', () => {
  expect(normalizeText('  Frozen \n  Foods  ')).toBe('Frozen Foods');
  expect(normalizeText('   ')).toBe('');
});

test('sameName ignores case and spacing', () => {
  expect(sameName('Produce', ' produce ')).toBe(true);
  expect(sameName('Deli', 'Bakery')).toBe(false);
});

test('createId returns distinct ids', () => {
  const ids = new Set(Array.from({ length: 50 }, createId));
  expect(ids.size).toBe(50);
  expect([...ids][0]).toHaveLength(16);
});

test('nameKey normalizes for comparison', () => {
  expect(nameKey('  Frozen   FOODS ')).toBe('frozen foods');
});
