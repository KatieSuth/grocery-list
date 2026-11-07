export type Department = {
  id: string;
  name: string;
};

export type Store = {
  id: string;
  name: string;
  /** Free-text location reference, e.g. "Main St". Optional. */
  location?: string;
  /** Departments in the order the user walks through the store. */
  departments: Department[];
  createdAt: number;
};

export type ItemLocation = {
  storeId: string;
  departmentId: string;
};

export type Item = {
  id: string;
  name: string;
  brand?: string;
  /** Where the item can be found: one department per store. */
  locations: ItemLocation[];
  createdAt: number;
  /** When it was last bought (a finished trip that included it). Kept here so lists needn't read the trip log. */
  lastBoughtAt?: number;
};

/**
 * An item the user has checked on their master list. Checking creates an entry;
 * unchecking deletes it, so the quantity is per check and starts blank each time.
 */
export type ListEntry = {
  /** The checked item's id (one entry per item). */
  itemId: string;
  /** Free text such as "4", "1 pint" or "1/2 pound". Optional. */
  quantity?: string;
  checkedAt: number;
  /**
   * When it was checked off on the current shopping trip, i.e. put in the cart. It stays on the
   * master list until the trip is finished.
   */
  inCartAt?: number;
};

/** One item in a finished trip, as it was at the time (the item may change or be deleted later). */
export type TripItem = {
  itemId: string;
  name: string;
  brand?: string;
  quantity?: string;
  /** The department it was in at that store. */
  department: string;
};

/** A finished store visit: what was bought, where and when. */
export type TripRecord = {
  id: string;
  storeId: string;
  /** The store's name at the time. */
  storeName: string;
  finishedAt: number;
  items: TripItem[];
  /**
   * Set while the trip is being finished: the record is written first, then the items are
   * updated and unchecked, then this is cleared. If finishing is interrupted, the next Finish
   * completes this same trip instead of logging a new one.
   */
  pending?: boolean;
};
