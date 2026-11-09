import type { RxJsonSchema } from 'rxdb';

import { COLOR_SCHEME_CHOICES, type ColorSchemeChoice } from '@/domain/appearance';
import { ITEM_SORTS, SORT_DIRECTIONS, type ItemSort, type SortDirection } from '@/domain/item-sort';
import type { Item, ListEntry, Store, TripRecord } from '@/domain/types';

export type SettingsDoc = {
  id: string;
  setupComplete: boolean;
  /** The store chosen on the Trip tab. */
  tripStoreId?: string;
  /** Whether the Trip tab lists departments in reverse walking order. */
  tripReversed?: boolean;
  /** Light, dark, or following the device. Absent means following the device. */
  colorScheme?: ColorSchemeChoice;
  /** How the master list is sorted when it opens. Absent means by name. */
  itemSort?: ItemSort;
  /** Which way: A–Z / newest first ('asc'), or the reverse. Absent means 'asc'. */
  itemSortDirection?: SortDirection;
};

export const SETTINGS_ID = 'app';

const timestamp = {
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
    createdAt: timestamp,
  },
  required: ['id', 'name', 'departments', 'createdAt'],
  indexes: ['createdAt'],
};

export const itemSchema: RxJsonSchema<Item> = {
  title: 'item',
  version: 1,
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
    createdAt: timestamp,
    lastBoughtAt: timestamp,
  },
  required: ['id', 'name', 'locations', 'createdAt'],
  indexes: ['createdAt'],
};

export const listEntrySchema: RxJsonSchema<ListEntry> = {
  title: 'list entry',
  version: 1,
  primaryKey: 'itemId',
  type: 'object',
  properties: {
    itemId: { type: 'string', maxLength: 64 },
    quantity: { type: 'string', maxLength: 40 },
    checkedAt: timestamp,
    inCartAt: timestamp,
  },
  required: ['itemId', 'checkedAt'],
};

export const settingsSchema: RxJsonSchema<SettingsDoc> = {
  title: 'settings',
  version: 3,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 32 },
    setupComplete: { type: 'boolean' },
    tripStoreId: { type: 'string' },
    tripReversed: { type: 'boolean' },
    colorScheme: { type: 'string', enum: [...COLOR_SCHEME_CHOICES] },
    itemSort: { type: 'string', enum: [...ITEM_SORTS] },
    itemSortDirection: { type: 'string', enum: [...SORT_DIRECTIONS] },
  },
  required: ['id', 'setupComplete'],
};

export const tripSchema: RxJsonSchema<TripRecord> = {
  title: 'trip',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    storeId: { type: 'string' },
    storeName: { type: 'string' },
    finishedAt: timestamp,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          name: { type: 'string' },
          brand: { type: 'string' },
          quantity: { type: 'string' },
          department: { type: 'string' },
        },
        required: ['itemId', 'name', 'department'],
      },
    },
    pending: { type: 'boolean' },
  },
  required: ['id', 'storeId', 'storeName', 'finishedAt', 'items'],
  indexes: ['finishedAt'],
};

const unchanged = <T>(doc: T) => doc;

/**
 * Version 1 of items, list entries, settings and trips only added optional fields, so version-0
 * documents are valid as they are.
 */
export const addedOptionalFields = { 1: unchanged };

/** Settings version 2 only added the optional colorScheme. */
export const settingsMigrations = { 1: unchanged, 2: unchanged, 3: unchanged };
