type RouteLike = { route: { params?: object } };

const param = (params: object | undefined, name: string) =>
  params && name in params && (params as Record<string, unknown>)[name];

/**
 * Stack screen options: the `edit` title when the route has an `id` param; the `copy` title (if
 * given) when it has a `copyFrom` param; else `add`.
 */
export function formTitle(titles: { add: string; edit: string; copy?: string }) {
  return ({ route }: RouteLike) => ({
    title: param(route.params, 'id')
      ? titles.edit
      : titles.copy && param(route.params, 'copyFrom')
        ? titles.copy
        : titles.add,
  });
}

export const STORE_FORM_TITLES = { add: 'Add a store', edit: 'Edit store', copy: 'Copy store' };
export const ITEM_FORM_TITLES = { add: 'Add an item', edit: 'Edit item' };
