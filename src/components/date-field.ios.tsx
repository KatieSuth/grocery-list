import { DatePicker, Host } from '@expo/ui/swift-ui';
import { StyleSheet, View } from 'react-native';

import type { DateFieldProps } from '@/components/date-field';
import { endOfDay, startOfDay } from '@/domain/trip-history';

/**
 * iOS: the platform's compact date picker, titled with the label ("From"). It shows the day and
 * opens a calendar; days outside `min`–`max` can't be chosen. VoiceOver reads it natively.
 */
export function DateField({ label, value, min, max, onChange }: DateFieldProps) {
  return (
    <View style={styles.field}>
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <DatePicker
          title={label}
          selection={new Date(value)}
          // The latest choice is a moment, so allow all of the last day.
          range={{ start: min === undefined ? undefined : new Date(min), end: new Date(endOfDay(max)) }}
          displayedComponents={['date']}
          onDateChange={(date) => onChange(startOfDay(date.getTime()))}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, minWidth: 140, minHeight: 48, justifyContent: 'center' },
  host: { width: '100%' },
});
