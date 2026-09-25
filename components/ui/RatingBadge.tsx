import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface RatingBadgeProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({
  rating,
  reviewCount,
  size = 'md',
  style,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const isSmall = size === 'sm';
  const displayRating = rating > 0 ? rating.toFixed(1) : 'New';

  return (
    <View
      style={[
        styles.container,
        {
          paddingVertical: isSmall ? 2 : Spacing.xxs,
          paddingHorizontal: isSmall ? Spacing.xs : Spacing.sm,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Rating: ${displayRating} stars${reviewCount ? `, based on ${reviewCount} reviews` : ''}`}
    >
      <Ionicons
        name="star"
        size={isSmall ? 11 : 13}
        color="#F59E0B"
        style={styles.star}
      />
      <Text style={[styles.ratingText, isSmall && styles.textSm]}>
        {displayRating}
      </Text>
      {reviewCount !== undefined && reviewCount > 0 ? (
        <Text style={[styles.countText, isSmall && styles.textSm]}>
          ({reviewCount})
        </Text>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: colors.warning,
    alignSelf: 'flex-start',
  },
  star: {
    marginRight: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    marginRight: 2,
  },
  countText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '500',
  },
  textSm: {
    fontSize: 11,
  },
});
let styles = createStyles(lightColors);
