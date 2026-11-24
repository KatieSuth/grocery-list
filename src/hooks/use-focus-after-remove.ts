import { useEffect, useRef, useState, type ComponentRef } from 'react';
import type { HostInstance, TextInput } from 'react-native';

import { moveAccessibilityFocus } from '@/utils/accessibility-focus';

/**
 * Keeps the screen reader's place when an entry is removed from a list with ✕ buttons (tags,
 * departments). Its ✕ had focus and is gone, so focus moves to the next entry's ✕, or to the
 * list's text field when it was the last one, instead of jumping somewhere unpredictable.
 */
export function useFocusAfterRemove() {
  const removeButtons = useRef(new Map<string, HostInstance>());
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  // Set after a removal; acted on once the list has re-rendered without the entry.
  const [next, setNext] = useState<{ key: string | undefined }>();

  useEffect(() => {
    if (!next) return;
    const target = next.key !== undefined ? removeButtons.current.get(next.key) : field.current;
    if (target) moveAccessibilityFocus(target);
  }, [next]);

  return {
    /** The ref for the ✕ of the entry with `key`. */
    removeButtonRef: (key: string) => (button: HostInstance | null) => {
      if (button) removeButtons.current.set(key, button);
      else removeButtons.current.delete(key);
    },
    /** The ref for the list's text field. */
    fieldRef: field,
    /** Call when removing `keys[index]` (the keys before the removal). */
    removed: (keys: string[], index: number) => setNext({ key: keys[index + 1] }),
  };
}
