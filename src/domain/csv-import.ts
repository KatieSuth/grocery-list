import Papa from 'papaparse';

import { FILE_TOO_BIG } from '@/utils/csv-file';
import { createId } from '@/utils/id';
import { nameKey } from '@/utils/text';

import { checkName, MAX_NAME_LENGTH } from './names';

import type { Department, Item, ItemLocation, Store } from './types';

/*
 * Importing stores, departments and items from a CSV file: "Store, Item name, Department, Brand,
 * Location". Brand and Location (the store's) are optional.
 *
 * The file comes from outside the app, so it's treated as hostile: its size, row count, field
 * lengths and characters are all bounded, it's parsed as plain text into arrays of strings
 * (never objects keyed by its contents, never evaluated), and it's checked as a whole before
 * anything is written. Ids always come from the app, never from the file.
 */

/** Largest file accepted, in bytes (and in characters once read). */
export const MAX_IMPORT_BYTES = 1_000_000;
/** Most data rows in one file (not counting a header or blank lines). */
export const MAX_IMPORT_ROWS = 2_000;
/** Longest store, item, department or brand name or store location, after spacing is tidied. */
export const MAX_FIELD_LENGTH = MAX_NAME_LENGTH;
/** Most departments a store can end up with. */
export const MAX_DEPARTMENTS_PER_STORE = 200;
/** Most stores there can be after an import. */
export const MAX_STORES = 100;
/** How many problems an error message lists before "…and N more". */
export const MAX_LISTED_ERRORS = 5;

export type ImportRow = {
  /** The row's number in the file, counting from 1 (as a spreadsheet would show it). */
  row: number;
  store: string;
  name: string;
  department: string;
  /** Empty when the item has no brand. */
  brand: string;
  /** The store's location, when the file gives one. */
  location?: string;
};

export type ImportError = {
  /** The row it's about, or none for a problem with the whole file. */
  row?: number;
  message: string;
};

export type ParseImportResult = { ok: true; rows: ImportRow[] } | { ok: false; errors: ImportError[] };

const COLUMNS = ['Store', 'Item name', 'Department', 'Brand', 'Location'] as const;
const OPTIONAL_COLUMNS: readonly string[] = ['Brand', 'Location'];

/** Shortens text quoted back to the user, so a hostile file can't flood an alert. */
export function quote(value: string): string {
  return `“${value.length > 30 ? `${value.slice(0, 29)}…` : value}”`;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

/**
 * Checks the file's text before parsing: not too big, and really text. Drops a leading byte
 * order mark (as Excel writes). Text that couldn't be decoded as UTF-8 — e.g. a picture or a
 * spreadsheet that isn't a CSV — contains the replacement character "�".
 */
export function prepareImportText(text: string): { ok: true; text: string } | { ok: false; error: string } {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: FILE_TOO_BIG };
  }
  if (text.includes('\uFFFD')) {
    return { ok: false, error: 'This doesn’t look like a CSV file. Save it as “CSV UTF-8” and try again.' };
  }
  return { ok: true, text: text.startsWith('\uFEFF') ? text.slice(1) : text };
}

function isHeader(cells: string[]): boolean {
  const [store, item, department, brand = '', location = ''] = cells.map(nameKey);
  return (
    store === 'store' &&
    (item === 'item name' || item === 'item') &&
    department === 'department' &&
    (brand === 'brand' || brand === '') &&
    (location === 'location' || location === 'store location' || location === '')
  );
}

/** Problems with one field, or its tidied value. The same rules as names typed in the app. */
function checkField(raw: string, column: (typeof COLUMNS)[number]): string | ImportError {
  const result = checkName(raw, column, { required: !OPTIONAL_COLUMNS.includes(column) });
  return result.ok ? result.value : { message: result.error };
}

/** Reads the CSV's rows. Every problem is collected, so the user can fix them all at once. */
export function parseImportCsv(text: string): ParseImportResult {
  const prepared = prepareImportText(text);
  if (!prepared.ok) return { ok: false, errors: [{ message: prepared.error }] };

  // Plain arrays of strings: no header objects (so no keys from the file), no type guessing,
  // no workers, no downloads. The delimiter is fixed rather than guessed.
  const parsed = Papa.parse<string[]>(prepared.text, {
    header: false,
    dynamicTyping: false,
    delimiter: ',',
    skipEmptyLines: false,
  });

  // One message per row, however many ways papaparse found its quotes to be wrong.
  const errors: ImportError[] = [...new Map(parsed.errors.map((e) => [e.row, e])).values()].map((e) => ({
    ...(e.row !== undefined ? { row: e.row + 1 } : {}),
    message:
      e.code === 'MissingQuotes'
        ? 'A quote (") is opened but never closed.'
        : 'A quote (") is in the wrong place. Put quotes around the whole value, and double any quotes inside it ("").',
  }));
  const rows: ImportRow[] = [];
  let firstRow = true;
  let dataRows = 0;

  for (const [index, rawCells] of parsed.data.entries()) {
    const row = index + 1;
    const cells = [...rawCells];
    // Spreadsheets often add empty cells at the end of rows; ignore those.
    while (cells.length > 0 && !cells[cells.length - 1].trim()) cells.pop();
    if (cells.length === 0) continue;

    if (firstRow) {
      firstRow = false;
      if (isHeader(cells)) continue;
    }

    dataRows += 1;
    if (dataRows > MAX_IMPORT_ROWS) {
      errors.push({ message: `The file has more than ${MAX_IMPORT_ROWS.toLocaleString('en-US')} rows. Split it into smaller files.` });
      break;
    }
    if (cells.length > COLUMNS.length) {
      errors.push({ row, message: 'There are more than 5 columns. Use: Store, Item name, Department, Brand, Location.' });
      continue;
    }

    const values = COLUMNS.map((column, i) => checkField(cells[i] ?? '', column));
    const problems = values.filter((v): v is ImportError => typeof v !== 'string');
    if (problems.length > 0) {
      errors.push(...problems.map((p) => ({ row, message: p.message })));
      continue;
    }
    const [store, name, department, brand, location] = values as string[];
    rows.push({ row, store, name, department, brand, ...(location ? { location } : {}) });
  }

  if (errors.length > 0) return { ok: false, errors };
  if (rows.length === 0) return { ok: false, errors: [{ message: 'There are no rows to import.' }] };
  return { ok: true, rows };
}

export type ImportCounts = {
  newStores: number;
  newDepartments: number;
  newItems: number;
  /** Existing items added to another store. */
  updatedItems: number;
  /** Existing stores without a location that get the one in the file. */
  locatedStores: number;
  /** Rows already in the app (or repeated in the file). */
  skipped: number;
};

export type ImportPlan = {
  /** Stores to create, with all their departments. */
  newStores: Store[];
  /** Departments to add to the end of existing stores, by store id. */
  departmentAdds: Map<string, Department[]>;
  /** Locations to give existing stores that have none, by store id. */
  storeLocations: Map<string, string>;
  newItems: Item[];
  /** Locations to add to existing items, by item id. */
  locationAdds: Map<string, ItemLocation[]>;
  counts: ImportCounts;
};

export type PlanImportResult = { ok: true; plan: ImportPlan } | { ok: false; errors: ImportError[] };

const itemKey = (name: string, brand: string) => `${nameKey(name)}\n${nameKey(brand)}`;

const locationKey = (store: Pick<Store, 'location'>) => nameKey(store.location ?? '');

/**
 * Which store a row means, among `stores` (the app's plus any the file has added so far):
 * - the store with the same name and location (the first, if there are several);
 * - else, for a row with a location: a store with that name and no location, which gets it;
 * - else, for a row without one: the only store with that name. If there are several, the row
 *   has to say which, so it's an error.
 * Undefined means the store is new.
 */
function matchStore(row: ImportRow, stores: Store[]): Store | ImportError | undefined {
  const named = stores.filter((s) => nameKey(s.name) === nameKey(row.store));
  const location = nameKey(row.location ?? '');
  const exact = named.find((s) => locationKey(s) === location);
  if (exact) return exact;
  if (location) return named.find((s) => !locationKey(s));
  if (named.length > 1) {
    return {
      row: row.row,
      message: `There’s more than one store called ${quote(row.store)}. Put its location in the Location column to say which.`,
    };
  }
  return named[0];
}

/**
 * Works out what importing `rows` would change, without changing anything. Names are matched
 * ignoring case and spacing, and existing spellings are kept. Stores are matched by name and
 * location (see matchStore). Stores and departments that don't exist yet are added; an item
 * that's already at the store in the same department is skipped. An item can be in only one
 * department per store, so a row that would put it in a second one is an error.
 */
export function planImport(rows: ImportRow[], stores: Store[], items: Item[], now = Date.now()): PlanImportResult {
  const errors: ImportError[] = [];
  // Working copies. Maps, not objects, so names like "__proto__" are just names.
  const working = stores.map((store) => ({ ...store, departments: [...store.departments] }));
  const itemsByKey = new Map<string, Item>();
  for (const item of items) {
    const key = itemKey(item.name, item.brand ?? '');
    if (!itemsByKey.has(key)) itemsByKey.set(key, { ...item, locations: [...item.locations] });
  }

  const newStores: Store[] = [];
  const departmentAdds = new Map<string, Department[]>();
  const storeLocations = new Map<string, string>();
  const newItems: Item[] = [];
  const locationAdds = new Map<string, ItemLocation[]>();
  const newItemIds = new Set<string>();
  /** Where each location added by this file came from, to explain conflicts within the file. */
  const rowOfLocation = new Map<string, number>();
  let skipped = 0;
  let newDepartments = 0;
  let order = 0;

  for (const row of rows) {
    const matched = matchStore(row, working);
    if (matched && !('id' in matched)) {
      errors.push(matched);
      continue;
    }
    let store = matched;
    if (!store) {
      store = {
        id: createId(),
        name: row.store,
        ...(row.location ? { location: row.location } : {}),
        departments: [],
        createdAt: now + order++,
      };
      working.push(store);
      newStores.push(store);
    } else if (row.location && !store.location) {
      // A store with no location yet gets the one in the file.
      store.location = row.location;
      if (!newStores.includes(store)) storeLocations.set(store.id, row.location);
    }

    let department = store.departments.find((d) => nameKey(d.name) === nameKey(row.department));
    if (!department) {
      department = { id: createId(), name: row.department };
      store.departments.push(department);
      newDepartments += 1;
      if (!newStores.includes(store)) {
        departmentAdds.set(store.id, [...(departmentAdds.get(store.id) ?? []), department]);
      }
    }

    const key = itemKey(row.name, row.brand);
    const location = { storeId: store.id, departmentId: department.id };
    const item = itemsByKey.get(key);
    if (!item) {
      const created: Item = {
        id: createId(),
        name: row.name,
        ...(row.brand ? { brand: row.brand } : {}),
        locations: [location],
        createdAt: now + order++,
      };
      itemsByKey.set(key, created);
      newItems.push(created);
      newItemIds.add(created.id);
      rowOfLocation.set(`${created.id}\n${store.id}`, row.row);
      continue;
    }

    const existing = item.locations.find((l) => l.storeId === store.id);
    if (existing) {
      if (existing.departmentId === department.id) {
        skipped += 1;
        continue;
      }
      const otherName = store.departments.find((d) => d.id === existing.departmentId)?.name ?? 'another department';
      const earlierRow = rowOfLocation.get(`${item.id}\n${store.id}`);
      errors.push({
        row: row.row,
        message:
          earlierRow !== undefined
            ? `${quote(item.name)} is in ${quote(otherName)} at ${quote(store.name)} on row ${earlierRow}, and in ${quote(department.name)} here. An item can be in only one department per store.`
            : `${quote(item.name)} is already in ${quote(otherName)} at ${quote(store.name)}, not ${quote(department.name)}. An item can be in only one department per store.`,
      });
      continue;
    }

    item.locations.push(location);
    rowOfLocation.set(`${item.id}\n${store.id}`, row.row);
    if (!newItemIds.has(item.id)) {
      locationAdds.set(item.id, [...(locationAdds.get(item.id) ?? []), location]);
    }
  }

  if (working.length > MAX_STORES) {
    errors.push({ message: `This would make more than ${MAX_STORES} stores.` });
  }
  for (const store of working) {
    if (store.departments.length > MAX_DEPARTMENTS_PER_STORE) {
      errors.push({ message: `${quote(store.name)} would have more than ${MAX_DEPARTMENTS_PER_STORE} departments.` });
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    plan: {
      newStores,
      departmentAdds,
      storeLocations,
      newItems,
      locationAdds,
      counts: {
        newStores: newStores.length,
        newDepartments,
        newItems: newItems.length,
        updatedItems: locationAdds.size,
        locatedStores: storeLocations.size,
        skipped,
      },
    },
  };
}

/** True when importing would change nothing (every row is already in the app). */
export function isEmptyImport({ newStores, newDepartments, newItems, updatedItems, locatedStores }: ImportCounts): boolean {
  return newStores + newDepartments + newItems + updatedItems + locatedStores === 0;
}

function changes({ newStores, newDepartments, newItems, updatedItems, locatedStores }: ImportCounts): string[] {
  return [
    ...(newItems > 0 ? [plural(newItems, 'new item')] : []),
    ...(updatedItems > 0 ? [`${plural(updatedItems, 'existing item')} at another store`] : []),
    ...(newStores > 0 ? [plural(newStores, 'new store')] : []),
    ...(newDepartments > 0 ? [plural(newDepartments, 'new department')] : []),
    ...(locatedStores > 0 ? [`a location for ${plural(locatedStores, 'existing store')}`] : []),
  ];
}

const joinList = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

function skippedSentence(skipped: number): string {
  return skipped > 0 ? ` ${plural(skipped, 'row is', 'rows are')} already in your list and will be skipped.` : '';
}

/** The question asked before importing, e.g. "This adds 3 new items and 1 new store. …". */
export function describeImportPlan(counts: ImportCounts): string {
  return `This adds ${joinList(changes(counts))}.${skippedSentence(counts.skipped)}`;
}

/** The message after importing. */
export function describeImportResult(counts: ImportCounts): string {
  return `Added ${joinList(changes(counts))}.`;
}

/** The first few problems, one per line, then how many more there are. */
export function describeImportErrors(errors: ImportError[]): string {
  const listed = errors
    .slice(0, MAX_LISTED_ERRORS)
    .map((e) => (e.row !== undefined ? `Row ${e.row}: ${e.message}` : e.message));
  const more = errors.length - MAX_LISTED_ERRORS;
  return [...listed, ...(more > 0 ? [`…and ${plural(more, 'more problem')}.`] : []), '', 'Nothing was imported.'].join('\n');
}
