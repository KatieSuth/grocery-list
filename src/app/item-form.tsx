import { ItemFormScreen } from '@/screens/item-form-screen';

/** The main app's item form. It covers the tabs, so it's closed (saved or not) before going elsewhere. */
export default function ItemForm() {
  return <ItemFormScreen backTo="/" />;
}
