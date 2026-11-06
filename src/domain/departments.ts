import { createId } from '@/utils/id';
import { normalizeText, sameName } from '@/utils/text';

import type { Department, Store } from './types';

/** Departments every new store starts with. The full list is still to be decided. */
export const DEFAULT_DEPARTMENT_NAMES = ['Produce', 'Deli', 'Frozen'] as const;

export function createDefaultDepartments(): Department[] {
  return DEFAULT_DEPARTMENT_NAMES.map((name) => ({ id: createId(), name }));
}

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
  const needle = normalizeText(query).toLocaleLowerCase();
  if (!needle) return [];

  const byKey = new Map<string, DepartmentSuggestion>();
  for (const store of stores) {
    for (const dept of store.departments) {
      const key = normalizeText(dept.name).toLocaleLowerCase();
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
