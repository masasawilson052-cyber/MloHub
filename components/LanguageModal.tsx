import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Language } from '../context/LanguageContext';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';

import { useTheme } from '../context/ThemeContext';
import { ThemeColors, lightColors } from '../theme/palettes';

let colors: ThemeColors = lightColors;

interface LanguageModalProps {
  visible: boolean;
  currentLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  onClose: () => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({
  visible,
  currentLanguage,
  onSelectLanguage,
  onClose,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const options: { id: Language; label: string; subLabel: string; flag: string }[] = [
    { id: 'en', label: 'English', subLabel: 'Default International', flag: '🇬🇧' },
    { id: 'sw', label: 'Kiswahili', subLabel: 'Lugha ya Taifa (Tanzania)', flag: '🇹🇿' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {currentLanguage === 'sw' ? 'Chagua Lugha' : 'Choose Language'}
              </Text>
              <Text style={styles.subtitle}>
                {currentLanguage === 'sw'
                  ? 'Badili lugha ya mfumo mzima wa MloHub'
                  : 'Select your preferred language for MloHub'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {options.map((opt) => {
              const isSelected = currentLanguage === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.item, isSelected && styles.itemSelected]}
                  onPress={() => {
                    onSelectLanguage(opt.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <Text style={styles.flagIcon}>{opt.flag}</Text>
                    <View>
                      <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.itemSub, isSelected && styles.itemSubSelected]}>
                        {opt.subLabel}
                      </Text>
                    </View>
                  </View>
                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    width: '100%',
    maxWidth: 380,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  list: {
    marginTop: Spacing.sm,
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.xl,
    backgroundColor: colors.appBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  flagIcon: {
    fontSize: 24,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemLabelSelected: {
    color: colors.onPrimary,
  },
  itemSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  itemSubSelected: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  checkIcon: {
    color: colors.onPrimary,
    fontWeight: '900',
    fontSize: 16,
  },
});
let styles = createStyles(lightColors);
