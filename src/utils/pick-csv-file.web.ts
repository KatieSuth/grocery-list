import * as DocumentPicker from 'expo-document-picker';

import { MAX_IMPORT_BYTES, prepareImportText } from '@/domain/csv-import';
import { CSV_MIME_TYPES, FILE_NOT_OPENED, FILE_NOT_READ, FILE_TOO_BIG, type PickCsvResult } from '@/utils/csv-file';

/**
 * Web version: the browser's file chooser hands back a File, read here directly (expo-file-system
 * isn't available on web). The file stays in the browser; nothing is uploaded.
 */
/** `onPicked` runs once the user has chosen a file, before it's read. */
export async function pickCsvFile(onPicked?: () => void): Promise<PickCsvResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...CSV_MIME_TYPES, '.csv'],
    multiple: false,
    base64: false,
  });
  if (result.canceled) return { status: 'canceled' };
  onPicked?.();

  const file = result.assets[0].file;
  if (!file) return { status: 'error', message: FILE_NOT_OPENED };
  if (file.size > MAX_IMPORT_BYTES) {
    return { status: 'error', message: FILE_TOO_BIG };
  }
  try {
    const prepared = prepareImportText(await file.text());
    return prepared.ok ? { status: 'picked', text: prepared.text } : { status: 'error', message: prepared.error };
  } catch {
    return { status: 'error', message: FILE_NOT_READ };
  }
}
