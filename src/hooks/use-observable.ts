import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';

/**
 * Subscribes to `source` and returns its latest value, or undefined until the first emission.
 * `source` must be referentially stable (e.g. created with useMemo).
 */
export function useObservable<T>(source: Observable<T>): T | undefined {
  const [state, setState] = useState<{ source: Observable<T>; value: T } | null>(null);

  useEffect(() => {
    const subscription = source.subscribe((value) => setState({ source, value }));
    return () => subscription.unsubscribe();
  }, [source]);

  return state?.source === source ? state.value : undefined;
}
