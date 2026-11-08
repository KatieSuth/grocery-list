import { use, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { SpaceBelowFocusedFieldContext } from '@/components/space-below-focused-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  optional?: boolean;
  /**
   * Height of content shown just below this field (e.g. autofill suggestions) that should stay
   * above the keyboard with it while it's focused.
   */
  extraSpaceBelow?: number;
};

export function TextField({ label, error, optional, extraSpaceBelow = 0, onFocus, onBlur, ...rest }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [errorHeight, setErrorHeight] = useState(0);

  // While typing, keep the error message (and anything else below) above the keyboard with the field.
  const reportSpaceBelow = use(SpaceBelowFocusedFieldContext);
  const errorSpace = error && errorHeight > 0 ? errorHeight + Spacing.one : 0;
  const spaceBelow = focused ? errorSpace + extraSpaceBelow : 0;
  useEffect(() => {
    if (spaceBelow === 0) return;
    reportSpaceBelow(spaceBelow);
    return () => reportSpaceBelow(0);
  }, [spaceBelow, reportSpaceBelow]);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">
        {label}
        {optional ? <ThemedText type="small" themeColor="textSecondary"> (optional)</ThemedText> : null}
      </ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      {error ? (
        <View onLayout={(e) => setErrorHeight(e.nativeEvent.layout.height)}>
          <ErrorText message={error} />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorText({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
