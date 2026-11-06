import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  compact?: boolean;
};

export function Button({ label, variant = 'primary', compact, disabled, ...rest }: Props) {
  const theme = useTheme();
  const background = {
    primary: theme.tint,
    secondary: theme.backgroundElement,
    danger: 'transparent',
    ghost: 'transparent',
  }[variant];
  const color = {
    primary: theme.onTint,
    secondary: theme.text,
    danger: theme.danger,
    ghost: theme.tint,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      aria-disabled={!!disabled}
      disabled={disabled}
      hitSlop={compact ? 8 : undefined}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: background, opacity: pressOpacity(pressed, disabled) },
        variant === 'danger' && { borderColor: theme.danger, borderWidth: 1 },
      ]}
      {...rest}>
      <ThemedText style={[styles.label, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  compact: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    flexGrow: 0,
  },
  label: {
    fontWeight: 600,
  },
});
