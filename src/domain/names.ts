import { normalizeText } from '@/utils/text';

/*
 * The rules for names typed in the app or read from an imported file: store, item, department
 * and brand names, and store locations. One set of rules, so a name the forms accept also
 * imports, and the other way round.
 */

/** Longest name, after spacing is tidied. */
export const MAX_NAME_LENGTH = 100;

/**
 * Characters a name may not contain: control characters (including NUL), bidirectional
 * overrides and isolates (which can make text display as something else), zero-width
 * characters (which make two names look the same) and the byte order mark. Tabs and line breaks
 * are allowed; they're whitespace and get collapsed into single spaces.
 */
const FORBIDDEN_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‍‪-‮⁦-⁩﻿]/;

export type NameCheck = { ok: true; value: string } | { ok: false; error: string };

/**
 * Checks a name and tidies its spacing. `label` starts the error messages, e.g. "Store name".
 * Optional names may be blank; required ones may not. `maxLength` defaults to MAX_NAME_LENGTH.
 */
export function checkName(
  raw: string,
  label: string,
  { required, maxLength = MAX_NAME_LENGTH }: { required: boolean; maxLength?: number },
): NameCheck {
  if (FORBIDDEN_CHARACTERS.test(raw)) {
    return { ok: false, error: `${label} contains hidden or control characters, which aren’t allowed.` };
  }
  const value = normalizeText(raw);
  if (required && !value) return { ok: false, error: `${label} is empty.` };
  if (value.length > maxLength) {
    return { ok: false, error: `${label} is longer than ${maxLength} characters.` };
  }
  return { ok: true, value };
}
