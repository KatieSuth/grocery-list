import { createId } from '@/utils/id';
import { nameKey, normalizeText, sameName } from '@/utils/text';

import { checkName } from './names';

import type { Department, Store } from './types';

export type AddDepartmentResult =
  | { ok: true; departments: Department[] }
  | { ok: false; error: string };

export function addDepartment(departments: Department[], rawName: string): AddDepartmentResult {
  if (!normalizeText(rawName)) {
    return { ok: false, error: 'Enter a department name.' };
  }
  const checked = checkName(rawName, 'Department name', { required: true });
  if (!checked.ok) return checked;
  const name = checked.value;
  if (departments.some((d) => sameName(d.name, name))) {
    return { ok: false, error: `"${name}" is already in the list.` };
  }
  return { ok: true, departments: [...departments, { id: createId(), name }] };
}

/** The message for a name that belongs to a department being removed in this edit. */
export const beingRemovedError = (name: string) => `"${name}" is being removed. Cancel the removal instead.`;

/**
 * Adds a typed department name, reusing the spelling of a department with that name at another
 * of `knownStores` (as the editor's Add does). A name matching one of `removed` (departments
 * removed in this edit, not yet saved) is refused: that department still exists until Save, so
 * its removal is cancelled instead (see restoreDepartment).
 */
export function addDepartmentFromStores(
  departments: Department[],
  rawName: string,
  knownStores: Store[],
  removed: Department[] = [],
): AddDepartmentResult {
  const known = suggestDepartments(rawName, knownStores, departments).find((s) => sameName(s.name, rawName));
  const result = addDepartment(departments, known?.name ?? rawName);
  if (!result.ok) return result;
  const removing = removed.find((d) => sameName(d.name, rawName));
  return removing ? { ok: false, error: beingRemovedError(removing.name) } : result;
}

/**
 * For saving: adds what's still typed in the New department field (`pending`) as if Add had been
 * tapped, so it isn't lost. Nothing typed, or a name already in the list, changes nothing; other
 * problems (including a department being removed, see addDepartmentFromStores) are returned, so
 * the form can say so instead of saving.
 */
export function addPendingDepartment(
  departments: Department[],
  pending: string,
  knownStores: Store[],
  removed: Department[] = [],
): AddDepartmentResult {
  if (!normalizeText(pending) || departments.some((d) => sameName(d.name, pending))) return { ok: true, departments };
  return addDepartmentFromStores(departments, pending, knownStores, removed);
}

/**
 * Cancels a department's removal: puts it back (same id, so its items keep it) just after the
 * last department still in the list that came before it in `original` (the store's order as
 * saved), or first if none did.
 */
export function restoreDepartment(departments: Department[], department: Department, original: Department[]): Department[] {
  const earlier = new Set(original.slice(0, original.findIndex((d) => d.id === department.id)).map((d) => d.id));
  let at = 0;
  departments.forEach((d, i) => {
    if (earlier.has(d.id)) at = i + 1;
  });
  return [...departments.slice(0, at), department, ...departments.slice(at)];
}

export function removeDepartment(departments: Department[], id: string): Department[] {
  return departments.filter((d) => d.id !== id);
}

export type CopyDepartmentsResult = {
  departments: Department[];
  /** Names that were added; empty if every name was already in the list. */
  added: string[];
};

/**
 * Appends `source`'s departments, in `source`'s order, after `current`'s. Names already in the list
 * (ignoring case and spacing) are skipped, so nothing is duplicated. Copies get fresh ids, because
 * departments belong to one store.
 */
export function copyDepartments(current: Department[], source: Department[]): CopyDepartmentsResult {
  const departments = [...current];
  const added: string[] = [];
  for (const dept of source) {
    const name = normalizeText(dept.name);
    if (!name || departments.some((d) => sameName(d.name, name))) continue;
    departments.push({ id: createId(), name });
    added.push(name);
  }
  return { departments, added };
}

/** Moves the department at `index` one step up (-1) or down (+1). Out-of-range moves are no-ops. */
export function moveDepartment(
  departments: Department[],
  index: number,
  direction: -1 | 1,
): Department[] {
  const target = index + direction;
  if (index < 0 || index >= departments.length || target < 0 || target >= departments.length) {
    return departments;
  }
  const next = [...departments];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Departments in A–Z order (ignoring case and accents), for picking one when adding an item.
 * The store's own order is the walking order, used on the shopping trip. Doesn't mutate.
 */
export function sortDepartmentsByName(departments: Department[]): Department[] {
  return [...departments].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export type DepartmentSuggestion = {
  /** The name as first spelled in the user's stores. */
  name: string;
  /** Stores that have a department with this name, in store order. */
  storeNames: string[];
};

export const MAX_DEPARTMENT_SUGGESTIONS = 5;

/**
 * Department names from the user's stores that match what they're typing, so they can reuse
 * them. Excludes names already in `current`. Names that start with the query rank first,
 * then names used at more stores, then alphabetical.
 */
export function suggestDepartments(
  query: string,
  stores: Store[],
  current: Department[],
): DepartmentSuggestion[] {
  const needle = nameKey(query);
  if (!needle) return [];

  const byKey = new Map<string, DepartmentSuggestion>();
  for (const store of stores) {
    for (const dept of store.departments) {
      const key = nameKey(dept.name);
      const entry = byKey.get(key) ?? { name: normalizeText(dept.name), storeNames: [] };
      if (!entry.storeNames.includes(store.name)) entry.storeNames.push(store.name);
      byKey.set(key, entry);
    }
  }

  const startsWith = (s: DepartmentSuggestion) => s.name.toLocaleLowerCase().startsWith(needle);
  return [...byKey.entries()]
    .filter(([key]) => key.includes(needle))
    .map(([, suggestion]) => suggestion)
    .filter((s) => !current.some((d) => sameName(d.name, s.name)))
    .sort(
      (a, b) =>
        Number(startsWith(b)) - Number(startsWith(a)) ||
        b.storeNames.length - a.storeNames.length ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_DEPARTMENT_SUGGESTIONS);
}
