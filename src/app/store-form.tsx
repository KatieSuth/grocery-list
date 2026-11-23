import { StoreFormScreen } from '@/screens/store-form-screen';

/** The main app's store form. It covers the tabs, so it's closed (saved or not) before going elsewhere. */
export default function StoreForm() {
  return <StoreFormScreen backTo="/stores" />;
}
