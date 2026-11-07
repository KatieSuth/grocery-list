/**
 * Jest stand-in for react-native-sortables. Real dragging needs native gestures, which Jest
 * can't perform (it's covered by the Playwright tests). This renders the rows normally and lets
 * a test simulate a drop through the same onDragEnd callback the library calls.
 */
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import type { SortableGridProps } from 'react-native-sortables';

let latest: SortableGridProps<unknown> | null = null;

function Grid<T>(props: SortableGridProps<T>) {
  useEffect(() => {
    latest = props as SortableGridProps<unknown>;
  });
  const key = props.keyExtractor ?? ((item: T) => String(item));
  return (
    <View>
      {props.data.map((item, index) => (
        <View key={key(item)}>{props.renderItem({ item, index })}</View>
      ))}
    </View>
  );
}

function Handle({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/** Simulates dragging the row at `fromIndex` and dropping it at `toIndex` in the most recently rendered grid. */
export function simulateSortableDrop(fromIndex: number, toIndex: number): void {
  if (!latest) throw new Error('No Sortable.Grid has been rendered.');
  const data = [...latest.data];
  const [moved] = data.splice(fromIndex, 1);
  data.splice(toIndex, 0, moved);
  const keys = data.map((item) => (latest?.keyExtractor ?? String)(item));
  latest.onDragEnd?.({
    key: keys[toIndex],
    fromIndex,
    toIndex,
    indexToKey: keys,
    keyToIndex: Object.fromEntries(keys.map((k, i) => [k, i])),
    data,
  });
}

export default { Grid, Handle };
