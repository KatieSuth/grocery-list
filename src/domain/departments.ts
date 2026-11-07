import { createId } from '@/utils/id';
import { nameKey, normalizeText, sameName } from '@/utils/text';

import type { Department, Store } from './types';

export type AddDepartmentResult =
  | { ok: true; departments: Department[] }
  | { ok: false; error: string };

export function addDepartment(departments: Department[], rawName: string): AddDepartmentResult {
  const name = normalizeText(rawName);
  if (!name) {
    return { ok: false, error: 'Enter a department name.' };
  }
  if (departments.some((d) => sameName(d.name, name))) {
    return { ok: false, error: `"${name}" is already in the list.` };
  }
  return { ok: true, departments: [...departments, { id: createId(), name }] };
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
