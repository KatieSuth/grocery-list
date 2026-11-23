import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Stand-ins for @expo/ui's native date pickers, which don't exist in Jest. They render plain
 * views carrying the props, so tests can find a picker and call its callbacks.
 */
function Host({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/** Android: the calendar dialog. */
function DatePickerDialog(props: Record<string, unknown>) {
  return <View testID="date-picker-dialog" {...props} />;
}

/** iOS: the compact date picker, found by its title. */
function DatePicker(props: { title?: string } & Record<string, unknown>) {
  return <View testID={`date-picker-${props.title}`} {...props} />;
}

export const jetpackCompose = { Host, DatePickerDialog };
export const swiftUI = { Host, DatePicker };
