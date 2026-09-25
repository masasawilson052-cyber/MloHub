import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export const DishCardSkeleton: React.FC = () => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  return (
    <View style={styles.card}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.titlePlaceholder} />
          <View style={styles.pricePlaceholder} />
        </View>
        <View style={styles.subPlaceholder} />
        <View style={styles.footerRow}>
          <View style={styles.ratingPlaceholder} />
          <View style={styles.badgePlaceholder} />
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  imagePlaceholder: {
    height: 140,
    width: '100%',
    backgroundColor: '#e8ece9',
  },
  body: {
    padding: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titlePlaceholder: {
    width: '60%',
    height: 16,
    borderRadius: Radii.sm,
    backgroundColor: '#e2e7e4',
  },
  pricePlaceholder: {
    width: '25%',
    height: 16,
    borderRadius: Radii.sm,
    backgroundColor: '#d8deda',
  },
  subPlaceholder: {
    width: '45%',
    height: 12,
    borderRadius: Radii.sm,
    backgroundColor: '#edf1ee',
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  ratingPlaceholder: {
    width: 60,
    height: 14,
    borderRadius: Radii.sm,
    backgroundColor: '#edf1ee',
  },
  badgePlaceholder: {
    width: 80,
    height: 20,
    borderRadius: Radii.full,
    backgroundColor: '#edf1ee',
  },
});
let styles = createStyles(lightColors);
