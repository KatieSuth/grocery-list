import { checkName, MAX_NAME_LENGTH } from '@/domain/names';

test('a name is tidied and accepted', () => {
  expect(checkName('  Frozen \t Foods\n', 'Department', { required: true })).toEqual({ ok: true, value: 'Frozen Foods' });
  expect(checkName('x'.repeat(MAX_NAME_LENGTH), 'Store', { required: true }).ok).toBe(true);
  expect(checkName('Café 🥐 日本', 'Store', { required: true }).ok).toBe(true);
});

test('a required name can’t be blank; an optional one can', () => {
  expect(checkName('   ', 'Store', { required: true })).toEqual({ ok: false, error: 'Store is empty.' });
  expect(checkName('   ', 'Brand', { required: false })).toEqual({ ok: true, value: '' });
});

test('a name can’t be too long', () => {
  expect(checkName('x'.repeat(MAX_NAME_LENGTH + 1), 'Brand', { required: false })).toEqual({
    ok: false,
    error: `Brand is longer than ${MAX_NAME_LENGTH} characters.`,
  });
});

test.each([
  ['NUL', 'Mi\u0000lk'],
  ['bell', 'Mi\u0007lk'],
  ['DEL', 'Mi\u007Flk'],
  ['C1 control', 'Mi\u0085lk'],
  ['zero-width space', 'Mi​lk'],
  ['zero-width joiner', 'Mi‍lk'],
  ['right-to-left override', 'Mi‮lk'],
  ['left-to-right embedding', 'Mi‪lk'],
  ['bidi isolate', 'Mi⁦lk'],
  ['pop isolate', 'Mi⁩lk'],
  ['byte order mark', 'Mi﻿lk'],
])('hidden or control characters are refused: %s', (_label, raw) => {
  expect(checkName(raw, 'Item name', { required: true })).toEqual({
    ok: false,
    error: 'Item name contains hidden or control characters, which aren’t allowed.',
  });
});
