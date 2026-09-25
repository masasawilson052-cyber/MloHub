import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ThemeMode } from '../../theme/palettes';

export interface ThemeQuickSwitcherProps {
  compact?: boolean;
}

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { mode: 'LIGHT', label: 'Light', icon: 'sunny-outline' },
  { mode: 'DARK', label: 'Dark', icon: 'moon-outline' },
  { mode: 'SYSTEM', label: 'System', icon: 'desktop-outline' },
];

export const ThemeQuickSwitcher: React.FC<ThemeQuickSwitcherProps> = ({ compact = false }) => {
  const { mode, resolvedMode, colors, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<any>(null);
  const [anchorPos, setAnchorPos] = useState<{ top: number; right: number }>({
    top: 56,
    right: 16,
  });

  const activeIcon: keyof typeof Ionicons.glyphMap =
    mode === 'LIGHT'
      ? 'sunny-outline'
      : mode === 'DARK'
      ? 'moon-outline'
      : 'desktop-outline';

  const handleOpen = () => {
    if (Platform.OS === 'web' && triggerRef.current?.getBoundingClientRect) {
      try {
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const rightOffset = Math.max(12, viewportW - rect.right);
        const topOffset = Math.max(48, rect.bottom + 8);
        setAnchorPos({ top: topOffset, right: rightOffset });
      } catch {
        setAnchorPos({ top: 56, right: 16 });
      }
    }
    setOpen((prev) => !prev);
  };

  const handleClose = () => {
    setOpen(false);
    if (Platform.OS === 'web' && triggerRef.current?.focus) {
      try {
        triggerRef.current.focus();
      } catch {
        // Ignore focus restoration errors
      }
    }
  };

  const handleSelect = async (targetMode: ThemeMode) => {
    await setMode(targetMode);
    handleClose();
  };

  // Close on Escape key on Web
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        ref={triggerRef}
        style={[
          styles.triggerBtn,
          compact && styles.triggerBtnCompact,
          {
            backgroundColor: colors.surfaceInteractive,
            borderColor: open ? colors.primary : colors.border,
          },
        ]}
        onPress={handleOpen}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Change appearance"
        accessibilityState={{ expanded: open }}
      >
        <Ionicons
          name={activeIcon}
          size={compact ? 17 : 18}
          color={open ? colors.primary : colors.textPrimary}
        />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: 'transparent' }]}
          onPress={handleClose}
          accessibilityLabel="Close appearance menu"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.menuPanel,
              {
                top: anchorPos.top,
                right: anchorPos.right,
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.borderStrong,
              },
            ]}
            accessibilityRole="menu"
          >
            <View style={[styles.menuHeader, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.menuTitle, { color: colors.textMuted }]}>
                Appearance
              </Text>
              {mode === 'SYSTEM' && (
                <Text style={[styles.systemResolvedBadge, { color: colors.textSecondary }]}>
                  {resolvedMode === 'DARK' ? 'Dark' : 'Light'}
                </Text>
              )}
            </View>

            {THEME_OPTIONS.map((opt) => {
              const selected = mode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.menuItem,
                    selected && { backgroundColor: colors.navActiveBackground },
                  ]}
                  onPress={() => handleSelect(opt.mode)}
                  activeOpacity={0.75}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label} appearance`}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.menuItemLabel,
                        {
                          color: selected ? colors.textPrimary : colors.textSecondary,
                          fontWeight: selected ? '700' : '500',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 200,
  },
  triggerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  triggerBtnCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  backdrop: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  menuPanel: {
    position: 'absolute',
    width: 184,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.28)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 8,
      },
    }),
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
  },
  menuTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  systemResolvedBadge: {
    fontSize: 10,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    marginVertical: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  menuItemLabel: {
    fontSize: 13,
  },
});
