import {
  addPendingTag,
  addTag,
  checkTag,
  describeTags,
  knownTags,
  MAX_TAG_SUGGESTIONS,
  MAX_TAGS_PER_ITEM,
  removeTag,
  splitTagCell,
  suggestTags,
} from '@/domain/tags';
import type { Item } from '@/domain/types';

const item = (id: string, tags?: string[]): Item => ({ id, name: id, locations: [], createdAt: 1, ...(tags ? { tags } : {}) });

describe('checking a tag', () => {
  test('tidies spacing and refuses blank, long, hidden-character and separator tags', () => {
    expect(checkTag('  Work   trips ')).toEqual({ ok: true, value: 'Work trips' });
    expect(checkTag('   ')).toEqual({ ok: false, error: 'Enter a tag.' });
    expect(checkTag('a'.repeat(41))).toEqual({ ok: false, error: 'Tag is longer than 40 characters.' });
    expect(checkTag('a'.repeat(40))).toEqual({ ok: true, value: 'a'.repeat(40) });
    expect(checkTag('Work‮')).toMatchObject({ ok: false, error: expect.stringContaining('hidden') });
    expect(checkTag('Work; Patient')).toEqual({ ok: false, error: 'A tag can’t contain “;”.' });
  });
});

describe('adding and removing', () => {
  test('adds to the end, reusing a spelling already used elsewhere', () => {
    expect(addTag(['Patient'], ' work ', ['Work'])).toEqual({ ok: true, tags: ['Patient', 'Work'], tag: 'Work' });
    expect(addTag([], 'Errands', [])).toEqual({ ok: true, tags: ['Errands'], tag: 'Errands' });
  });

  test('refuses blank tags, repeats (ignoring case) and too many', () => {
    expect(addTag([], ' ', [])).toEqual({ ok: false, error: 'Enter a tag.' });
    expect(addTag(['Work'], 'WORK', [])).toEqual({ ok: false, error: '“Work” is already added.' });
    const full = Array.from({ length: MAX_TAGS_PER_ITEM }, (_, i) => `Tag ${i}`);
    expect(addTag(full, 'One more', [])).toEqual({ ok: false, error: 'An item can have up to 20 tags.' });
  });

  test('when saving, a tag still being typed is added; blank or already added changes nothing', () => {
    expect(addPendingTag(['Patient'], ' work ', ['Work'])).toEqual({ ok: true, tags: ['Patient', 'Work'] });
    const tags = ['Work'];
    expect(addPendingTag(tags, '  ', [])).toEqual({ ok: true, tags });
    expect(addPendingTag(tags, 'WORK', [])).toEqual({ ok: true, tags });
    expect(addPendingTag(tags, 'x'.repeat(41), [])).toEqual({ ok: false, error: 'Tag is longer than 40 characters.' });
  });

  test('removes just that tag', () => {
    expect(removeTag(['Work', 'Patient'], 'Work')).toEqual(['Patient']);
  });
});

describe('suggestions', () => {
  const items = [
    item('a', ['Work', 'Patient']),
    item('b', ['work ', 'Weekly']),
    item('c', ['Homework']),
    item('d', ['Pets']),
    item('e'),
  ];

  test('knownTags lists each tag once, with how many items use it', () => {
    expect(knownTags(items)).toEqual([
      { name: 'Work', count: 2 },
      { name: 'Patient', count: 1 },
      { name: 'Weekly', count: 1 },
      { name: 'Homework', count: 1 },
      { name: 'Pets', count: 1 },
    ]);
  });

  test('match anywhere, starting matches first, then the most used, then A–Z', () => {
    expect(suggestTags('w', items, [])).toEqual([
      { name: 'Work', count: 2 },
      { name: 'Weekly', count: 1 },
      { name: 'Homework', count: 1 },
    ]);
    expect(suggestTags('P', items, [])).toEqual([
      { name: 'Patient', count: 1 },
      { name: 'Pets', count: 1 },
    ]);
  });

  test("leave out tags already on the item, and offer nothing for blank text", () => {
    expect(suggestTags('w', items, ['WORK'])).toEqual([
      { name: 'Weekly', count: 1 },
      { name: 'Homework', count: 1 },
    ]);
    expect(suggestTags('  ', items, [])).toEqual([]);
  });

  test(`offer at most ${MAX_TAG_SUGGESTIONS}`, () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`i${i}`, [`Tag ${i}`]));
    expect(suggestTags('tag', many, [])).toHaveLength(MAX_TAG_SUGGESTIONS);
  });
});

test('a CSV cell splits on ";", leaving out empty pieces', () => {
  expect(splitTagCell(' Work ;; Patient  care; ')).toEqual(['Work', 'Patient care']);
  expect(splitTagCell('')).toEqual([]);
});

test('tags as shown and spoken', () => {
  expect(describeTags(['Work', 'Patient'])).toEqual({ shown: 'Work · Patient', spoken: 'Tags: Work, Patient' });
  expect(describeTags([])).toEqual({ shown: '', spoken: '' });
  expect(describeTags(undefined)).toEqual({ shown: '', spoken: '' });
});
