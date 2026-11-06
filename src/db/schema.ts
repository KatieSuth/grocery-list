import type { RxJsonSchema } from 'rxdb';

import type { Item, ListEntry, Store } from '@/domain/types';

export type SettingsDoc = {
  id: string;
  setupComplete: boolean;
};

export const SETTINGS_ID = 'app';

const createdAt = {
  type: 'number',
  minimum: 0,
  maximum: 9_999_999_999_999,
  multipleOf: 1,
} as const;

export const storeSchema: RxJsonSchema<Store> = {
  title: 'store',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    name: { type: 'string' },
    location: { type: 'string' },
    departments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      },
    },
    createdAt,
  },
  required: ['id', 'name', 'departments', 'createdAt'],
  indexes: ['createdAt'],
};

export const itemSchema: RxJsonSchema<Item> = {
  title: 'item',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    name: { type: 'string' },
    brand: { type: 'string' },
    locations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          storeId: { type: 'string' },
          departmentId: { type: 'string' },
        },
        required: ['storeId', 'departmentId'],
      },
    },
    createdAt,
  },
  required: ['id', 'name', 'locations', 'createdAt'],
  indexes: ['createdAt'],
};

export const listEntrySchema: RxJsonSchema<ListEntry> = {
  title: 'list entry',
  version: 0,
  primaryKey: 'itemId',
  type: 'object',
  properties: {
    itemId: { type: 'string', maxLength: 64 },
    quantity: { type: 'string', maxLength: 40 },
    checkedAt: createdAt,
  },
  required: ['itemId', 'checkedAt'],
};

export const settingsSchema: RxJsonSchema<SettingsDoc> = {
  title: 'settings',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 32 },
    setupComplete: { type: 'boolean' },
  },
  required: ['id', 'setupComplete'],
};
