import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { getAppDatabase, type AppDatabase } from './database';

const DatabaseContext = createContext<AppDatabase | null>(null);

type Props = {
  children: ReactNode;
  /** Shown while the database opens, and with the error if it fails. */
  fallback?: (error: Error | null) => ReactNode;
  load?: () => Promise<AppDatabase>;
};

export function DatabaseProvider({ children, fallback, load = getAppDatabase }: Props) {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    load().then(
      (database) => {
        if (active) setDb(database);
      },
      (e: unknown) => {
        if (active) setError(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      active = false;
    };
  }, [load]);

  if (!db) {
    return fallback ? fallback(error) : null;
  }
  return <DatabaseContext value={db}>{children}</DatabaseContext>;
}

export function useDatabase(): AppDatabase {
  const db = use(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used inside a <DatabaseProvider>.');
  }
  return db;
}
