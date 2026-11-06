import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** The visual square of a checkbox. Wrap it in a Pressable with accessibilityRole="checkbox". */
export function CheckboxBox({ checked }: { checked: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.box,
        { borderColor: checked ? theme.tint : theme.textSecondary },
        checked && { backgroundColor: theme.tint },
      ]}>
      {checked ? <ThemedText style={[styles.check, { color: theme.onTint }]}>✓</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { lineHeight: 20 },
});
