import { router, type Href } from 'expo-router';

/** Goes back if there is history (e.g. not opened from a deep link), otherwise replaces with `fallback`. */
export function goBack(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
