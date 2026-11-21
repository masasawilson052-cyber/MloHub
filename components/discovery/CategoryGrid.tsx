import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FOOD_CATEGORIES, FoodCategory } from '../../config/foodCategories';
import { DESKTOP_MIN_WIDTH } from '../../constants/layout';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { Spacing, Radii } from '../../constants/theme';

let colors: ThemeColors = lightColors;

interface CategoryGridProps {
  onSelectCategory?: (category: FoodCategory) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({ onSelectCategory }) => {
  const router = useRouter();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  const isDesktop = width >= DESKTOP_MIN_WIDTH;

  const handlePress = (category: FoodCategory) => {
    if (onSelectCategory) {
      onSelectCategory(category);
    } else {
      router.push({
        pathname: '/(tabs)/explore',
        params: { category: category.id },
      });
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.gridContainer, isDesktop ? styles.desktopRow : styles.mobileGrid]}>
        {FOOD_CATEGORIES.map((category) => {
          const label = language === 'sw' ? category.labelSw : category.labelEn;
          return (
            <TouchableOpacity
              key={category.id}
              style={[styles.itemTouchable, isDesktop ? styles.desktopItem : styles.mobileItem]}
              onPress={() => handlePress(category)}
              accessibilityRole="button"
              accessibilityLabel={label}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons
                  name={category.icon as any}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.itemLabel} numberOfLines={2}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      paddingVertical: Spacing.sm,
    },
    gridContainer: {
      width: '100%',
      flexDirection: 'row',
    },
    mobileGrid: {
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: Spacing.md,
    },
    desktopRow: {
      flexWrap: 'nowrap',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    itemTouchable: {
      minHeight: 76,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingHorizontal: 2,
      paddingVertical: 4,
    },
    mobileItem: {
      width: '25%', // 4 columns on mobile
    },
    desktopItem: {
      flex: 1, // 8 columns in 1 single row on desktop
      maxWidth: 120,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceInteractive,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemLabel: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.textPrimary,
      lineHeight: 14,
      paddingHorizontal: 2,
    },
  });
