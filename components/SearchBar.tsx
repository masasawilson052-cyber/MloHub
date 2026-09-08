import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

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
  const { t, language } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={Colors.subtle}
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    padding: Spacing.xs,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 12,
    color: Colors.subtle,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radii.lg,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  filterBtnTextActive: {
    color: Colors.white,
  },
  badge: {
    width: 16,
    height: 16,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
});
