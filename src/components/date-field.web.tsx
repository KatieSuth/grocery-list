import { StyleSheet, View } from 'react-native';

import type { DateFieldProps } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "2026-11-23" for a local day, as date inputs use. */
export function toInputValue(day: number): string {
  const date = new Date(day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local day for a date input's value, or undefined if it's blank or not a date. */
export function fromInputValue(text: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return undefined;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 ? date.getTime() : undefined;
}

/**
 * Web: the browser's date input, which has its own calendar. Days outside `min`–`max`, or a
 * cleared field, are ignored, so the range always stays valid.
 */
export function DateField({ label, value, min, max, onChange }: DateFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <input
        type="date"
        aria-label={label}
        value={toInputValue(value)}
        min={min === undefined ? undefined : toInputValue(min)}
        max={toInputValue(max)}
        onChange={(event) => {
          const day = fromInputValue(event.currentTarget.value);
          if (day !== undefined && (min === undefined || day >= min) && day <= max) onChange(day);
        }}
        style={{
          minHeight: 48,
          boxSizing: 'border-box',
          padding: `0 ${Spacing.three}px`,
          fontSize: 16,
          color: theme.text,
          backgroundColor: theme.background,
          border: `1px solid ${theme.controlBorder}`,
          borderRadius: 10,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, minWidth: 140, gap: Spacing.half },
});
