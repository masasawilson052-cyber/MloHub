import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { Spacing, Radii, Shadows } from '../../constants/theme';

export interface CategoryTabBarProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  tabScrollViewRef?: React.RefObject<ScrollView | null>;
  onPillLayout?: (category: string, layout: { x: number; width: number }) => void;
}

export const CategoryTabBar: React.FC<CategoryTabBarProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  tabScrollViewRef,
  onPillLayout,
}) => {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.tabBarContainer}>
      <ScrollView
        ref={tabScrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryPillsRow}
        keyboardShouldPersistTaps="handled"
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              onPress={() => onSelectCategory(cat)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                onPillLayout?.(cat, { x, width });
              }}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Category ${cat}`}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  isActive && styles.categoryPillTextActive,
                ]}
              >
                {cat === 'All' ? t('menuAllCategories') : cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabBarContainer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: Spacing.xs,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
    },
    categoryPillsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      gap: Spacing.xs,
    },
    categoryPill: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs + 2,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    categoryPillTextActive: {
      color: colors.onPrimary || '#FFFFFF',
      fontWeight: '700',
    },
  });
