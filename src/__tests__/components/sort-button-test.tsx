import { render, screen } from '@testing-library/react-native';

import { SortButton } from '@/components/sort-button';
import { Colors } from '@/constants/theme';
import type { ItemSortChoice } from '@/domain/item-sort';

/** The icon's tint: highlighted when the list isn't in the user's default order. */
async function tint(sort: ItemSortChoice, defaultChoice: ItemSortChoice, expanded = false) {
  await render(<SortButton {...sort} defaultChoice={defaultChoice} expanded={expanded} onPress={() => {}} />);
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

test('the sort button is highlighted only when the list differs from the chosen default', async () => {
  const byName = { sort: 'name', direction: 'asc' } as const;
  const byDepartmentDesc = { sort: 'department', direction: 'desc' } as const;
  expect(await tint(byName, byName)).toBe(Colors.light.text);
  expect(await tint(byDepartmentDesc, byDepartmentDesc)).toBe(Colors.light.text);
  expect(await tint(byName, byDepartmentDesc)).toBe(Colors.light.tint);
  expect(await tint({ sort: 'department', direction: 'asc' }, byDepartmentDesc)).toBe(Colors.light.tint);
  // Open, it's highlighted too.
  expect(await tint(byName, byName, true)).toBe(Colors.light.tint);
});
