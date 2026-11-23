import { DatePickerDialog, Host } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDay, formatDaySpoken, localDayToUtcDay, utcDayToLocalDay } from '@/domain/trip-history';
import { useTheme } from '@/hooks/use-theme';

export type DateFieldProps = {
  /** "From" or "To". */
  label: string;
  /** The chosen day (local midnight). */
  value: number;
  /** The earliest and latest days that can be chosen (local midnights). */
  min?: number;
  max: number;
  onChange: (day: number) => void;
};

/**
 * Android: a field showing the chosen day that opens the platform's calendar dialog. Days outside
 * `min`–`max` are greyed out there. (iOS and web: see date-field.ios.tsx and date-field.web.tsx.)
 */
export function DateField({ label, value, min, max, onChange }: DateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.flex}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDaySpoken(value)}`}
        accessibilityHint="Opens a calendar to choose the day"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.background, borderColor: theme.controlBorder, opacity: pressOpacity(pressed) },
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText>{formatDay(value)}</ThemedText>
      </Pressable>
      {open ? (
        <Host matchContents>
          <DatePickerDialog
            // The calendar works in UTC days; the bounds it converts itself.
            initialDate={new Date(localDayToUtcDay(value)).toISOString()}
            selectableDates={{ start: min === undefined ? undefined : new Date(min), end: new Date(max) }}
            color={theme.tint}
            onDateSelected={(date) => {
              setOpen(false);
              onChange(utcDayToLocalDay(date.getTime()));
            }}
            onDismissRequest={() => setOpen(false)}
          />
        </Host>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 140 },
  field: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 10,
  },
});
