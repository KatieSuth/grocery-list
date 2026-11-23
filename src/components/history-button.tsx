import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import { useTheme } from '@/hooks/use-theme';

/** The clock icon at the top right of the Shopping trip screen: opens the log of past trips. */
export function HistoryButton() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Trip history"
      accessibilityHint="Shows your past shopping trips"
      onPress={() => router.push('/trip/history')}
      style={({ pressed }) => [styles.button, { opacity: pressOpacity(pressed) }]}>
      <SymbolView
        name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
        tintColor={theme.text}
        size={26}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
