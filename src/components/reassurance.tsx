import { ThemedText } from '@/components/themed-text';

/** Reminds the user nothing in setup is final. */
export function Reassurance() {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      Don&apos;t worry about getting everything now. You can add, edit, or remove stores and items at any time.
    </ThemedText>
  );
}
