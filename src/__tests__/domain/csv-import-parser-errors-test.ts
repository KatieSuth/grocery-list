import { parseImportCsv } from '@/domain/csv-import';

// papaparse may report a problem that isn't tied to a row; the file is still refused.
jest.mock('papaparse', () => ({
  parse: () => ({
    data: [['Kroger', 'Milk', 'Dairy']],
    errors: [{ type: 'Delimiter', code: 'UndetectableDelimiter', message: 'x' }],
    meta: {},
  }),
}));

test('a parser problem with no row still stops the import', () => {
  expect(parseImportCsv('anything')).toEqual({
    ok: false,
    errors: [
      { message: 'A quote (") is in the wrong place. Put quotes around the whole value, and double any quotes inside it ("").' },
    ],
  });
});
