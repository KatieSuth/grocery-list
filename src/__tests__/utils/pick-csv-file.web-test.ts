import * as DocumentPicker from 'expo-document-picker';

import { MAX_IMPORT_BYTES } from '@/domain/csv-import';
import { CSV_MIME_TYPES } from '@/utils/csv-file';
import { pickCsvFile } from '@/utils/pick-csv-file';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const pickerReturns = (file: File | undefined | null) =>
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(
    file === null
      ? { canceled: true, assets: null }
      : { canceled: false, assets: [{ uri: 'blob:x', name: 'list.csv', lastModified: 0, file }] }
  );

/** A browser File whose text() is controlled by the test (jsdom's File can't read). */
const fileWith = (text: () => Promise<string>, size = 20) =>
  Object.defineProperties(new File([''], 'list.csv'), { text: { value: text }, size: { value: size } });

test('on web, the browser’s File is read directly; nothing is uploaded', async () => {
  pickerReturns(fileWith(() => Promise.resolve('Kroger,Milk,Dairy')));
  const onPicked = jest.fn();
  expect(await pickCsvFile(onPicked)).toEqual({ status: 'picked', text: 'Kroger,Milk,Dairy' });
  expect(onPicked).toHaveBeenCalledTimes(1);
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
    type: [...CSV_MIME_TYPES, '.csv'],
    multiple: false,
    base64: false,
  });
});

test('on web, canceling, a missing file, a big file or a bad read are handled', async () => {
  pickerReturns(null);
  const onPicked = jest.fn();
  expect(await pickCsvFile(onPicked)).toEqual({ status: 'canceled' });
  expect(onPicked).not.toHaveBeenCalled();

  pickerReturns(undefined);
  expect(await pickCsvFile()).toEqual({ status: 'error', message: 'That file couldn’t be opened.' });

  const text = jest.fn();
  pickerReturns(fileWith(text, MAX_IMPORT_BYTES + 1));
  expect(await pickCsvFile()).toEqual({ status: 'error', message: 'The file is too big. Import files of up to 1 MB.' });
  expect(text).not.toHaveBeenCalled();

  pickerReturns(fileWith(() => Promise.reject(new Error('io'))));
  expect(await pickCsvFile()).toEqual({ status: 'error', message: 'That file couldn’t be read.' });

  pickerReturns(fileWith(() => Promise.resolve('�')));
  expect(await pickCsvFile()).toMatchObject({ status: 'error' });
});
