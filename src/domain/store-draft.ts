import { normalizeText } from '@/utils/text';

import type { Department, Store } from './types';

export type StoreDraft = {
  name: string;
  location: string;
  departments: Department[];
};

export type StoreDraftErrors = {
  name?: string;
  departments?: string;
};

export function emptyStoreDraft(): StoreDraft {
  return { name: '', location: '', departments: [] };
}

export function storeToDraft(store: Store): StoreDraft {
  return {
    name: store.name,
    location: store.location ?? '',
    departments: store.departments.map((d) => ({ ...d })),
  };
}

export function validateStoreDraft(draft: StoreDraft): StoreDraftErrors {
  const errors: StoreDraftErrors = {};
  if (!normalizeText(draft.name)) {
    errors.name = 'Store name is required.';
  }
  if (draft.departments.length === 0) {
    errors.departments = 'Add at least one department so items can be placed in this store.';
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}
