import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

import { MAX_IMPORT_BYTES } from '@/domain/csv-import';
import { CSV_MIME_TYPES } from '@/utils/csv-file';
import { pickCsvFile } from '@/utils/pick-csv-file';

const CACHE = 'file:///data/user/0/app/cache/';

// A stand-in for the picked file: its size, contents, and whether it was deleted.
const mockFile = { exists: true, size: 20, text: jest.fn(), delete: jest.fn() };
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///data/user/0/app/cache/' } },
  File: jest.fn().mockImplementation((uri: string) => Object.assign(mockFile, { uri })),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const pickerReturns = (uri: string | null) =>
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue(
    uri === null
      ? { canceled: true, assets: null }
      : { canceled: false, assets: [{ uri, name: 'list.csv', lastModified: 0 }] }
  );

beforeEach(() => {
  Object.assign(mockFile, { exists: true, size: 20 });
  mockFile.text.mockReset().mockResolvedValue('﻿Kroger,Milk,Dairy');
  mockFile.delete.mockReset();
});

test('picking a CSV reads it as text, then deletes any cached copy', async () => {
  pickerReturns(`${CACHE}DocumentPicker/list.csv`);
  expect(await pickCsvFile()).toEqual({ status: 'picked', text: 'Kroger,Milk,Dairy' });
  // One file, CSV-ish types only. Android reads the picked file through its content:// link
  // (Expo Go can't read the picker's cached copy); iOS needs the copy to read it at all.
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
    type: CSV_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: Platform.OS !== 'android',
  });
  expect(mockFile.delete).toHaveBeenCalledTimes(1);
});

test('an empty file, or one whose size is unknown, is refused without being read', async () => {
  pickerReturns('content://com.android.providers.downloads.documents/document/7');
  mockFile.size = 0;
  expect(await pickCsvFile()).toEqual({ status: 'error', message: 'That file is empty.' });
  expect(mockFile.text).not.toHaveBeenCalled();
});

test('canceling the picker does nothing', async () => {
  pickerReturns(null);
  expect(await pickCsvFile()).toEqual({ status: 'canceled' });
});

test('a file that is too big is refused without being read', async () => {
  pickerReturns(`${CACHE}big.csv`);
  mockFile.size = MAX_IMPORT_BYTES + 1;
  expect(await pickCsvFile()).toEqual({ status: 'error', message: 'The file is too big. Import files of up to 1 MB.' });
  expect(mockFile.text).not.toHaveBeenCalled();
  expect(mockFile.delete).toHaveBeenCalledTimes(1);
});

test('a file that can’t be opened or read says so', async () => {
  pickerReturns(`${CACHE}gone.csv`);
  mockFile.exists = false;
  expect(await pickCsvFile()).toEqual({ status: 'error', message: 'That file couldn’t be opened.' });

  mockFile.exists = true;
  mockFile.text.mockRejectedValue(new Error('io'));
  expect(await pickCsvFile()).toEqual({ status: 'error', message: 'That file couldn’t be read.' });
});

test('a file that isn’t text is refused', async () => {
  pickerReturns(`${CACHE}photo.csv`);
  mockFile.text.mockResolvedValue('�PNG�');
  expect(await pickCsvFile()).toEqual({
    status: 'error',
    message: 'This doesn’t look like a CSV file. Save it as “CSV UTF-8” and try again.',
  });
});

test('only the copy in the app’s cache is ever deleted', async () => {
  pickerReturns('content://com.android.providers.downloads/document/42');
  expect(await pickCsvFile()).toEqual({ status: 'picked', text: 'Kroger,Milk,Dairy' });
  expect(mockFile.delete).not.toHaveBeenCalled();
});

test('a copy that can’t be deleted doesn’t stop the import', async () => {
  pickerReturns(`${CACHE}list.csv`);
  mockFile.delete.mockImplementation(() => {
    throw new Error('busy');
  });
  expect(await pickCsvFile()).toEqual({ status: 'picked', text: 'Kroger,Milk,Dairy' });
});
