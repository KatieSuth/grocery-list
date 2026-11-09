import { ChoiceChips } from '@/components/choice-chips';
import {
  directionLabels,
  directionSpoken,
  ITEM_SORTS,
  SORT_DIRECTIONS,
  SORT_LABELS,
  type ItemSort,
  type SortDirection,
} from '@/domain/item-sort';

type Props = {
  sort: ItemSort;
  direction: SortDirection;
  onChangeSort: (sort: ItemSort) => void;
  onChangeDirection: (direction: SortDirection) => void;
  /** For the default sort in Settings: headed and spoken as defaults ("Default sort: name"). */
  asDefault?: boolean;
};

/**
 * What the master list is ordered by, and which way (A–Z or Z–A, newest or oldest first).
 * Used by the master list's sort panel and by the default sort in Settings.
 */
export function SortChoices({ sort, direction, onChangeSort, onChangeDirection, asDefault = false }: Props) {
  return (
    <>
      <ChoiceChips
        title={asDefault ? 'Default sort' : 'Sort by'}
        choices={ITEM_SORTS.map((value) => ({
          value,
          label: SORT_LABELS[value],
          spoken: `${asDefault ? 'Default sort:' : 'Sort by'} ${SORT_LABELS[value].toLowerCase()}`,
        }))}
        selected={sort}
        onChange={onChangeSort}
      />
      <ChoiceChips
        title={asDefault ? 'Default order' : 'Order'}
        choices={SORT_DIRECTIONS.map((value) => ({
          value,
          label: directionLabels(sort)[value],
          spoken: asDefault ? `Default order: ${directionSpoken(sort)[value]}` : directionSpoken(sort)[value],
        }))}
        selected={direction}
        onChange={onChangeDirection}
      />
    </>
  );
}
