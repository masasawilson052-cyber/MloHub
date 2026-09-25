import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

import { useTheme } from '../context/ThemeContext';
import { ThemeColors, lightColors } from '../theme/palettes';

let colors: ThemeColors = lightColors;

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  filtersOpen: boolean;
  activeFilterCount: number;
  onToggleFilters: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  filtersOpen,
  activeFilterCount,
  onToggleFilters,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { t, language } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel="Search restaurants or cuisines"
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={styles.clearBtn}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.filterBtn,
          (filtersOpen || activeFilterCount > 0) && styles.filterBtnActive,
        ]}
        onPress={onToggleFilters}
        activeOpacity={0.8}
        accessibilityLabel="Toggle search filters"
      >
        <Text
          style={[
            styles.filterBtnText,
            (filtersOpen || activeFilterCount > 0) && styles.filterBtnTextActive,
          ]}
        >
          {language === 'sw' ? '⚙ Vichujio' : '⚙ Filters'}
        </Text>
        {activeFilterCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeFilterCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.card,
    padding: Spacing.xs,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.sm,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: Spacing.sm,
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radii.lg,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  filterBtnTextActive: {
    color: colors.onPrimary,
  },
  badge: {
    width: 16,
    height: 16,
    borderRadius: Radii.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: 9,
    fontWeight: '900',
  },
});
let styles = createStyles(lightColors);
