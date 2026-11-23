import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ToggleSwitch } from '@/components/toggle-switch';
import { Spacing } from '@/constants/theme';

type Props = {
  label: string;
  /** A line under the label saying what the switch does. */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Spoken after the label and state; defaults to the description. */
  accessibilityHint?: string;
};

/**
 * A labelled on/off setting. The whole row is one control: tapping anywhere on it toggles the
 * switch, and screen readers announce it once ("Needed, switch, on") rather than reading the
 * label and then the switch separately.
 */
export function SwitchRow({ label, description, value, onValueChange, accessibilityHint }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? description}
      onPress={() => onValueChange(!value)}
      style={styles.row}>
      <View style={styles.text}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      {/* The row is the accessible control; the switch only shows its state (and still works if tapped). */}
      <View aria-hidden importantForAccessibility="no-hide-descendants">
        <ToggleSwitch testID="switch-row-toggle" value={value} onValueChange={onValueChange} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 48 },
  text: { flex: 1, gap: Spacing.half },
});
