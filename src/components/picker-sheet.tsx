import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PickerOption = {
  key: string;
  title: string;
  /** Smaller lines under the title. */
  details?: string[];
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** The current choice: highlighted and marked with a check. */
  current?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  options: PickerOption[];
  onChoose: (key: string) => void;
  onCancel: () => void;
  /** Spoken label for Cancel, saying what's being cancelled. */
  cancelAccessibilityLabel: string;
};

/** A dialog that asks the user to pick one of several options, or cancel. */
export function PickerSheet({
  visible,
  title,
  message,
  options,
  onChoose,
  onCancel,
  cancelAccessibilityLabel,
}: Props) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          aria-label={title.replace(/…$/, '')}
          style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {title}
            </ThemedText>
            {message ? (
              <ThemedText type="small" themeColor="textSecondary">
                {message}
              </ThemedText>
            ) : null}
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={option.accessibilityLabel}
                accessibilityHint={option.accessibilityHint}
                onPress={() => onChoose(option.key)}
                style={({ pressed }) => [
                  styles.choice,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: option.current ? theme.tint : 'transparent',
                    opacity: pressOpacity(pressed),
                  },
                ]}>
                <View style={styles.choiceText}>
                  <ThemedText style={styles.choiceTitle}>{option.title}</ThemedText>
                  {option.details?.map((detail) => (
                    <ThemedText key={detail} type="small" themeColor="textSecondary" numberOfLines={2}>
                      {detail}
                    </ThemedText>
                  ))}
                </View>
                {option.current ? <ThemedText style={{ color: theme.tint }}>✓</ThemedText> : null}
              </Pressable>
            ))}
          </ScrollView>
          <Button
            variant="secondary"
            label="Cancel"
            accessibilityLabel={cancelAccessibilityLabel}
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    alignSelf: 'center',
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: { gap: Spacing.one },
  title: { fontSize: 22, lineHeight: 28 },
  list: { flexGrow: 0 },
  listContent: { gap: Spacing.two },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 2,
    minHeight: 48,
  },
  choiceText: { flex: 1, gap: Spacing.half },
  choiceTitle: { fontWeight: 600 },
});
