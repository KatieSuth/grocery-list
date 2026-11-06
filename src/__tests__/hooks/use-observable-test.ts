import { act, renderHook } from '@testing-library/react-native';
import { Subject } from 'rxjs';

import { useObservable } from '@/hooks/use-observable';

test('returns the latest value, resets when the source changes, and unsubscribes', async () => {
  const a = new Subject<number>();
  const b = new Subject<number>();
  const { result, rerender, unmount } = await renderHook<number | undefined, { source: Subject<number> }>(
    ({ source }) => useObservable(source),
    {
      initialProps: { source: a },
    },
  );

  expect(result.current).toBeUndefined();
  await act(async () => a.next(1));
  expect(result.current).toBe(1);

  await rerender({ source: b });
  expect(result.current).toBeUndefined();
  expect(a.observed).toBe(false);
  await act(async () => b.next(2));
  expect(result.current).toBe(2);

  await unmount();
  expect(b.observed).toBe(false);
});
