/** Shared by the native and web CSV pickers (pick-csv-file.ts / .web.ts). */

export type PickCsvResult = { status: 'canceled' } | { status: 'picked'; text: string } | { status: 'error'; message: string };

/** What the file picker offers. Phones label CSV files inconsistently, so allow the usual names. */
export const CSV_MIME_TYPES = [
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
];

export const FILE_TOO_BIG = 'The file is too big. Import files of up to 1 MB.';
export const FILE_EMPTY = 'That file is empty.';
export const FILE_NOT_OPENED = 'That file couldn’t be opened.';
export const FILE_NOT_READ = 'That file couldn’t be read.';
