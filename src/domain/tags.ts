import { nameKey, normalizeText, sameName } from '@/utils/text';

import { checkName } from './names';

import type { Item } from './types';

/*
 * Tags: the user's own labels for items, e.g. "Work", "Patient" or "Temporary". Optional, several
 * per item, kept in the order added. Two tags that differ only in case or spacing are the same tag.
 */

/** Longest tag, after spacing is tidied: short enough to fit on a row. */
export const MAX_TAG_LENGTH = 40;
/** Most tags one item can have. */
export const MAX_TAGS_PER_ITEM = 20;
/** Separates tags in one CSV cell, so it can't be part of a tag. */
export const TAG_SEPARATOR = ';';
/** How many suggestions are offered while typing. */
export const MAX_TAG_SUGGESTIONS = 5;

export type TagCheck = { ok: true; value: string } | { ok: false; error: string };

/** Checks one tag and tidies its spacing. */
export function checkTag(raw: string): TagCheck {
  if (!normalizeText(raw)) return { ok: false, error: 'Enter a tag.' };
  if (raw.includes(TAG_SEPARATOR)) return { ok: false, error: `A tag can’t contain “${TAG_SEPARATOR}”.` };
  return checkName(raw, 'Tag', { required: true, maxLength: MAX_TAG_LENGTH });
}

/** Every tag used on `items`, once each (the first spelling seen), with how many items use it. */
export function knownTags(items: Item[]): { name: string; count: number }[] {
  const byKey = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      const entry = byKey.get(nameKey(tag)) ?? { name: normalizeText(tag), count: 0 };
      entry.count += 1;
      byKey.set(nameKey(tag), entry);
    }
  }
  return [...byKey.values()];
}

export type AddTagResult = { ok: true; tags: string[]; tag: string } | { ok: false; error: string };

/**
 * Adds a tag to the end of `tags`. A tag already used elsewhere (`known`) keeps that spelling,
 * so "work" becomes "Work" if that's how it's been written. Blank, invalid and repeated tags
 * are refused, as is one past MAX_TAGS_PER_ITEM.
 */
export function addTag(tags: string[], raw: string, known: string[]): AddTagResult {
  const checked = checkTag(raw);
  if (!checked.ok) return checked;
  const tag = known.find((k) => sameName(k, checked.value)) ?? checked.value;
  const existing = tags.find((t) => sameName(t, tag));
  if (existing) return { ok: false, error: `“${existing}” is already added.` };
  if (tags.length >= MAX_TAGS_PER_ITEM) return { ok: false, error: `An item can have up to ${MAX_TAGS_PER_ITEM} tags.` };
  return { ok: true, tags: [...tags, tag], tag };
}

/**
 * For saving: adds what's still typed in the New tag field (`pending`) as if Add had been tapped,
 * so it isn't lost. Nothing typed, or a tag that's already added, changes nothing; other
 * problems (too long, too many) are returned, so the form can say so instead of saving.
 */
export function addPendingTag(
  tags: string[],
  pending: string,
  known: string[],
): { ok: true; tags: string[] } | { ok: false; error: string } {
  if (!normalizeText(pending) || tags.some((t) => sameName(t, pending))) return { ok: true, tags };
  const result = addTag(tags, pending, known);
  return result.ok ? { ok: true, tags: result.tags } : result;
}

export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => t !== tag);
}

export type TagSuggestion = { name: string; count: number };

/**
 * Tags on other items that contain what's being typed, to reuse them. Excludes tags already in
 * `current`. Tags starting with the text rank first, then the most used, then A–Z.
 */
export function suggestTags(query: string, items: Item[], current: string[]): TagSuggestion[] {
  const needle = nameKey(query);
  if (!needle) return [];
  const starts = (s: TagSuggestion) => nameKey(s.name).startsWith(needle);
  return knownTags(items)
    .filter((t) => nameKey(t.name).includes(needle) && !current.some((c) => sameName(c, t.name)))
    .sort((a, b) => Number(starts(b)) - Number(starts(a)) || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, MAX_TAG_SUGGESTIONS);
}

/** The pieces of a CSV Tags cell ("Work; Patient"): tidied, without empty pieces. Not yet checked. */
export function splitTagCell(cell: string): string[] {
  return cell
    .split(TAG_SEPARATOR)
    .map(normalizeText)
    .filter((t) => t);
}

/** Tags as shown on a row ("Work · Patient") and as spoken ("Tags: Work, Patient"); empty for none. */
export function describeTags(tags: string[] | undefined): { shown: string; spoken: string } {
  if (!tags || tags.length === 0) return { shown: '', spoken: '' };
  return { shown: tags.join(' · '), spoken: `Tags: ${tags.join(', ')}` };
}
