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
};
