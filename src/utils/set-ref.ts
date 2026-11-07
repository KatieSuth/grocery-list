/**
 * Hands `value` to a ref the way React does: calls it if it's a callback ref, otherwise sets
 * `.current`. Reanimated's animated refs are callable, but its Jest mock's are plain objects.
 */
export function setRef<T>(ref: ((value: T) => unknown) | { current: T } | null | undefined, value: T): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}
