import { render, screen } from '@testing-library/react-native';

import { FilterButton } from '@/components/filter-button';
import { Colors } from '@/constants/theme';
import type { ItemSortChoice } from '@/domain/item-sort';

/** The icon's tint: highlighted when the list isn't in the user's default order. */
async function tint(sort: ItemSortChoice, defaultChoice: ItemSortChoice, expanded = false, count = 0) {
  await render(<FilterButton count={count} {...sort} defaultChoice={defaultChoice} expanded={expanded} onPress={() => {}} />);
  type Node = { props?: Record<string, unknown>; children?: (Node | string)[] | null };
  const find = (node: Node | string | null): unknown => {
    if (!node || typeof node === 'string') return undefined;
    // iOS: an SF Symbol with a tint. Android: a Material Symbols glyph in that color.
    if (node.props?.tintColor !== undefined) return node.props.tintColor;
    const style = node.props?.style as { color?: string } | undefined;
    if (style?.color !== undefined) return style.color;
    for (const child of node.children ?? []) {
      const found = find(child);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return find(screen.toJSON() as Node);
}

test('the sort and filter button is highlighted when the sort differs from the default, filters are on, or it is open', async () => {
  const byName = { sort: 'name', direction: 'asc' } as const;
  const byDepartmentDesc = { sort: 'department', direction: 'desc' } as const;
  expect(await tint(byName, byName)).toBe(Colors.light.text);
  expect(await tint(byDepartmentDesc, byDepartmentDesc)).toBe(Colors.light.text);
  expect(await tint(byName, byDepartmentDesc)).toBe(Colors.light.tint);
  expect(await tint({ sort: 'department', direction: 'asc' }, byDepartmentDesc)).toBe(Colors.light.tint);
  // Filters on, or open: highlighted too.
  expect(await tint(byName, byName, false, 2)).toBe(Colors.light.tint);
  expect(await tint(byName, byName, true)).toBe(Colors.light.tint);
});

test('the sort and filter button announces the sort and how many filters are on', async () => {
  const label = async (sort: ItemSortChoice, count: number) => {
    await render(<FilterButton count={count} {...sort} defaultChoice={sort} expanded={false} onPress={() => {}} />);
    return screen.getByRole('button').props.accessibilityLabel as string;
  };
  expect(await label({ sort: 'name', direction: 'asc' }, 0)).toBe('Sort and filter, by name, A to Z');
  expect(await label({ sort: 'department', direction: 'desc' }, 1)).toBe(
    'Sort and filter, by department, Z to A, 1 filter on',
  );
  expect(await label({ sort: 'lastBought', direction: 'asc' }, 3)).toBe(
    'Sort and filter, by last bought, Newest first, 3 filters on',
  );
});
