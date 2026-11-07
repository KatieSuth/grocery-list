import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props<T extends string> = {
  title: string;
  choices: { value: T; label: string; spoken: string }[];
  selected: T;
  onChange: (value: T) => void;
};

/** A titled row of chips where exactly one is chosen (a radio group). */
export function ChoiceChips<T extends string>({ title, choices, selected, onChange }: Props<T>) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={title}>
        {choices.map(({ value, label, spoken }) => {
          const on = selected === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              aria-checked={on}
              accessibilityLabel={spoken}
              onPress={() => onChange(value)}
              style={[
                styles.chip,
                { borderColor: on ? theme.tint : theme.border, backgroundColor: on ? theme.tint : theme.background },
              ]}>
              <ThemedText type="small" style={{ color: on ? theme.onTint : theme.text }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
  },
});
