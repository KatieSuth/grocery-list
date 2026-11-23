import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type HostInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pressOpacity } from '@/components/press-feedback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { storeLabel } from '@/domain/describe';
import type { Store } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { moveAccessibilityFocus } from '@/utils/accessibility-focus';
import { measureInWindow, type WindowRect } from '@/utils/measure';
import { menuPosition } from '@/utils/menu-position';

type Props = {
  /** The store the menu is for; the menu is shown while this is set. */
  store: Store | null;
  /** The store's row, which the menu is shown under. */
  anchor: HostInstance | null;
  onEdit: (store: Store) => void;
  onCopy: (store: Store) => void;
  onDelete: (store: Store) => void;
  /** Called when the menu is dismissed without choosing (tap outside, back, Escape). */
  onClose: () => void;
};

type Action = {
  key: 'edit' | 'copy' | 'delete';
  label: string;
  /** Spoken, naming the store, e.g. "Copy Kroger, Main St". */
  verb: string;
  icon: SymbolViewProps['name'];
  danger?: boolean;
};

const ACTIONS: Action[] = [
  { key: 'edit', label: 'Edit', verb: 'Edit', icon: { ios: 'pencil', android: 'edit', web: 'edit' } },
  {
    key: 'copy',
    label: 'Copy store',
    verb: 'Copy',
    icon: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  },
  {
    key: 'delete',
    label: 'Delete store',
    verb: 'Delete',
    icon: { ios: 'trash', android: 'delete', web: 'delete' },
    danger: true,
  },
];

/**
 * The options for a store, shown when its row on the Stores tab is long-pressed: a small menu
 * just under the row (or above it, if there's no room below) with Edit, Copy store and Delete
 * store. Tapping outside it, Back, Escape or the screen reader's escape gesture closes it.
 */
export function StoreActionsMenu({ store, anchor, onEdit, onCopy, onDelete, onClose }: Props) {
  if (!store) return null;
  return (
    <Menu key={store.id} store={store} anchor={anchor} onEdit={onEdit} onCopy={onCopy} onDelete={onDelete} onClose={onClose} />
  );
}

function Menu({ store, anchor, onEdit, onCopy, onDelete, onClose }: Props & { store: Store }) {
  const theme = useTheme();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rect, setRect] = useState<WindowRect>();
  const [height, setHeight] = useState<number>();
  const firstItem = useRef<HostInstance>(null);

  useEffect(() => {
    let current = true;
    if (anchor) void measureInWindow(anchor).then((r) => current && setRect(r));
    return () => {
      current = false;
    };
  }, [anchor]);

  // Once the menu is in place, move the screen reader to its first option.
  const placed = height !== undefined;
  useEffect(() => {
    if (placed && firstItem.current) moveAccessibilityFocus(firstItem.current);
  }, [placed]);

  const position = rect
    ? menuPosition(rect, height, { width: window.width, height: window.height, insets })
    : // Not measured (yet): centred, so it's still usable.
      menuPosition(
        { x: 0, y: window.height / 2 - 100, width: window.width, height: 0 },
        height,
        { width: window.width, height: window.height, insets },
      );

  const dismiss = () => {
    onClose();
    // Put the screen reader back on the store the menu was for.
    if (anchor) moveAccessibilityFocus(anchor);
  };

  const choose = (action: Action['key']) => {
    ({ edit: onEdit, copy: onCopy, delete: onDelete })[action](store);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.fill}>
        {/* Tapping outside the menu closes it. Screen readers use Back or the escape gesture instead. */}
        <Pressable
          testID="store-menu-backdrop"
          accessible={false}
          importantForAccessibility="no"
          aria-hidden
          onPress={dismiss}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View
          accessibilityRole="menu"
          accessibilityLabel={`Options for ${storeLabel(store)}`}
          accessibilityViewIsModal
          aria-modal
          onAccessibilityEscape={dismiss}
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={[
            styles.menu,
            position,
            { backgroundColor: theme.background, borderColor: theme.controlBorder, opacity: placed ? 1 : 0 },
          ]}>
          {ACTIONS.map((action, i) => {
            const color = action.danger ? theme.danger : theme.text;
            return (
              <Pressable
                key={action.key}
                ref={i === 0 ? firstItem : undefined}
                accessibilityRole="menuitem"
                accessibilityLabel={`${action.verb} ${storeLabel(store)}`}
                onPress={() => choose(action.key)}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  { opacity: pressOpacity(pressed) },
                ]}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                  <SymbolView name={action.icon} tintColor={color} size={22} />
                </View>
                <ThemedText style={[styles.label, { color }]}>{action.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Lighter than a dialog's: the list stays visible, so it's clear which store the menu is for.
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.2)' },
  menu: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  label: { flex: 1, fontWeight: 600 },
});
