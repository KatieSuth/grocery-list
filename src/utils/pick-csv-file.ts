import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { MAX_IMPORT_BYTES, prepareImportText } from '@/domain/csv-import';
import {
  CSV_MIME_TYPES,
  FILE_EMPTY,
  FILE_NOT_OPENED,
  FILE_NOT_READ,
  FILE_TOO_BIG,
  type PickCsvResult,
} from '@/utils/csv-file';

/**
 * Lets the user pick one CSV file and reads it as text. The system picker runs outside the app
 * and hands back only the chosen file. Nothing else on the device is touched.
 *
 * - Android: the picker returns a one-time content:// link to the chosen file, which is read
 *   directly; nothing is copied. (Its copy would land in a cache folder that Expo Go's file
 *   sandbox won't let the app read, so the file would look missing.)
 * - iOS: the picker copies the file into the app's cache, which is the only way to read it
 *   straight away; that copy is deleted once it's read.
 */
export async function pickCsvFile(): Promise<PickCsvResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: CSV_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: Platform.OS !== 'android',
  });
  if (result.canceled) return { status: 'canceled' };

  const file = new File(result.assets[0].uri);
  try {
    // Check the size before reading, so a huge file is never loaded into memory.
    if (!file.exists) return { status: 'error', message: FILE_NOT_OPENED };
    // A size of 0 can also mean "unknown"; never read a file whose size can't be bounded.
    if (!(file.size > 0)) return { status: 'error', message: FILE_EMPTY };
    if (file.size > MAX_IMPORT_BYTES) return { status: 'error', message: FILE_TOO_BIG };
    const prepared = prepareImportText(await file.text());
    return prepared.ok ? { status: 'picked', text: prepared.text } : { status: 'error', message: prepared.error };
  } catch {
    return { status: 'error', message: FILE_NOT_READ };
  } finally {
    // Only ever delete the picker's copy in our own cache, never a file elsewhere.
    if (file.uri.startsWith(Paths.cache.uri)) {
      try {
        file.delete();
      } catch {
        // The system clears its cache anyway.
      }
    }
  }
}
