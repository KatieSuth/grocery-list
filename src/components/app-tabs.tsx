import { NativeTabs } from 'expo-router/native-tabs';

import { TabBarClearsSystemBarContext } from '@/components/tab-bar-clears-system-bar';
import { useTheme } from '@/hooks/use-theme';

/** iOS/Android: the platform's native tab bar. (Web: see app-tabs.web.tsx.) */
export default function AppTabs() {
  const theme = useTheme();
  return (
    // The native tab bar pads itself for the system navigation bar; screens inside needn't.
    <TabBarClearsSystemBarContext value>
      <NativeTabs
        backgroundColor={theme.background}
        indicatorColor={theme.backgroundElement}
        tintColor={theme.tint}
        labelStyle={{ selected: { color: theme.tint } }}>
        {/* Items is first, and is the app's home screen ("/"), e.g. right after setup. */}
        <NativeTabs.Trigger name="(items)">
          <NativeTabs.Trigger.Label>Items</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="trip">
          <NativeTabs.Trigger.Label>Trip</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} md="shopping_cart" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="stores">
          <NativeTabs.Trigger.Label>Stores</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'storefront', selected: 'storefront.fill' }} md="storefront" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </TabBarClearsSystemBarContext>
  );
}
