import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { FreshnessTier } from '../../types/discovery';

export interface FreshnessBadgeProps {
  tier: FreshnessTier;
  label?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  tier,
  label,
  style,
  size = 'md',
}) => {
  const getConfig = () => {
    switch (tier) {
      case 'FRESH':
        return {
          iconName: 'checkmark-circle' as const,
          iconColor: Colors.success,
          bgColor: Colors.successLight,
          textColor: Colors.success,
          borderColor: '#C6F6D5',
          defaultLabel: 'Verified today',
        };
      case 'RECENT':
        return {
          iconName: 'checkmark-circle-outline' as const,
          iconColor: Colors.primary,
          bgColor: Colors.primaryMuted,
          textColor: Colors.primaryDark,
          borderColor: '#D4EDDA',
          defaultLabel: 'Verified recently',
        };
      case 'AGING':
        return {
          iconName: 'time-outline' as const,
          iconColor: Colors.warning,
          bgColor: Colors.warningLight,
          textColor: Colors.warning,
          borderColor: '#FEEBC8',
          defaultLabel: 'Updated this month',
        };
      case 'STALE':
        return {
          iconName: 'alert-circle-outline' as const,
          iconColor: Colors.error,
          bgColor: Colors.errorLight,
          textColor: Colors.error,
          borderColor: '#FED7D7',
          defaultLabel: 'Price may be outdated',
        };
      case 'UNKNOWN':
      default:
        return {
          iconName: 'help-circle-outline' as const,
          iconColor: Colors.textMuted,
          bgColor: Colors.surfaceSecondary,
          textColor: Colors.textSecondary,
          borderColor: Colors.borderLight,
          defaultLabel: 'Not recently verified',
        };
    }
  };

  const config = getConfig();
  const displayLabel = label || config.defaultLabel;
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          paddingVertical: isSmall ? 2 : Spacing.xxs,
          paddingHorizontal: isSmall ? Spacing.xs : Spacing.sm,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Menu freshness: ${displayLabel}`}
    >
      <Ionicons
        name={config.iconName}
        size={isSmall ? 12 : 14}
        color={config.iconColor}
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          {
            color: config.textColor,
            fontSize: isSmall ? 11 : 12,
          },
        ]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
    lineHeight: 16,
  },
});
