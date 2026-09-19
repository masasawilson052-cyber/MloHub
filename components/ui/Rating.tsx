import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';

export interface RatingProps {
  rating: number;
  reviewCount?: number;
  isVerified?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Rating: React.FC<RatingProps> = ({
  rating,
  reviewCount,
  isVerified = false,
  size = 'md',
  showCount = true,
  style,
}) => {
  if (rating === undefined || rating === null || rating <= 0) {
    return null;
  }

  const formattedRating = rating.toFixed(1);

  const getStarSize = () => {
    switch (size) {
      case 'sm':
        return 12;
      case 'lg':
        return 18;
      case 'md':
      default:
        return 14;
    }
  };

  return (
    <View style={[styles.container, style]} accessible={true} accessibilityLabel={`Rated ${formattedRating} out of 5 stars`}>
      <View style={styles.starRow}>
        <Ionicons name="star" size={getStarSize()} color={Colors.saffron} />
        <Text
          style={[
            styles.ratingText,
            size === 'sm' && styles.textSm,
            size === 'lg' && styles.textLg,
          ]}
        >
          {formattedRating}
        </Text>
      </View>

      {showCount && reviewCount !== undefined && reviewCount > 0 ? (
        <Text
          style={[
            styles.countText,
            size === 'sm' && styles.countSm,
            size === 'lg' && styles.countLg,
          ]}
        >
          ({reviewCount})
        </Text>
      ) : null}

      {isVerified ? (
        <View style={styles.verifiedBadge} accessible={true} accessibilityLabel="Verified reviews">
          <Ionicons name="checkmark-circle" size={size === 'sm' ? 10 : 12} color={Colors.botanicalGreen} />
        </View>
      ) : null}
    </View>
  );
};

// Also export RatingBadge for backward compatibility
export const RatingBadge = Rating;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    ...Typography.bodyMedium,
    color: Colors.brandInk,
    fontWeight: '700',
    fontSize: 13,
  },
  textSm: {
    fontSize: 11,
  },
  textLg: {
    fontSize: 16,
  },
  countText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 12,
  },
  countSm: {
    fontSize: 10,
  },
  countLg: {
    fontSize: 14,
  },
  verifiedBadge: {
    marginLeft: 1,
  },
});
