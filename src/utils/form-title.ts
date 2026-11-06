type RouteLike = { route: { params?: object } };

/** Stack screen options: the `edit` title when the route has an `id` param, else `add`. */
export function formTitle(titles: { add: string; edit: string }) {
  return ({ route }: RouteLike) => ({
    title: route.params && 'id' in route.params && route.params.id ? titles.edit : titles.add,
  });
}

export const STORE_FORM_TITLES = { add: 'Add a store', edit: 'Edit store' };
export const ITEM_FORM_TITLES = { add: 'Add an item', edit: 'Edit item' };
