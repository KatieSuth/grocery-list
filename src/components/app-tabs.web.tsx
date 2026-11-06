import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS = [
  { name: '(trip)', href: '/', label: 'Trip', icon: 'shopping_cart' },
  { name: 'items', href: '/items', label: 'Items', icon: 'list' },
  { name: 'stores', href: '/stores', label: 'Stores', icon: 'storefront' },
] as const;

/**
 * Web: NativeTabs draws its bar at the top of the page over the screen header, so web gets
 * a bottom tab bar built from expo-router's headless tabs, with the same Material icons as Android.
 */
export default function AppTabs() {
  const theme = useTheme();
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList style={[styles.bar, { backgroundColor: theme.background, borderColor: theme.border }]}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { label: string; icon: AndroidSymbol };

function TabButton({ label, icon, isFocused, ...props }: TabButtonProps) {
  const theme = useTheme();
  const color = isFocused ? theme.tint : theme.textSecondary;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      aria-selected={!!isFocused}
      style={styles.tab}>
      <SymbolView name={{ web: icon }} tintColor={color} size={24} />
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    minHeight: 56,
  },
});
