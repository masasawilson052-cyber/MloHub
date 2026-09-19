import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';

export type AvailabilityStatus = 'AVAILABLE' | 'LOW_STOCK' | 'SOLD_OUT' | 'UNKNOWN';

export interface AvailabilityBadgeProps {
  status: AvailabilityStatus;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}

export const AvailabilityBadge: React.FC<AvailabilityBadgeProps> = ({
  status,
  style,
  size = 'md',
}) => {
  const getConfig = () => {
    switch (status) {
      case 'AVAILABLE':
        return {
          label: 'Available',
          iconName: 'radio-button-on' as const,
          color: Colors.success,
          bgColor: Colors.successLight,
          borderColor: '#C6F6D5',
        };
      case 'LOW_STOCK':
        return {
          label: 'Low stock',
          iconName: 'alert-circle' as const,
          color: Colors.warning,
          bgColor: Colors.warningLight,
          borderColor: '#FEEBC8',
        };
      case 'SOLD_OUT':
        return {
          label: 'Sold out',
          iconName: 'close-circle' as const,
          color: Colors.error,
          bgColor: Colors.errorLight,
          borderColor: '#FED7D7',
        };
      case 'UNKNOWN':
      default:
        return {
          label: 'Availability unconfirmed',
          iconName: 'help-circle' as const,
          color: Colors.textMuted,
          bgColor: Colors.surfaceSecondary,
          borderColor: Colors.borderLight,
        };
    }
  };

  const config = getConfig();
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
      accessibilityLabel={`Stock status: ${config.label}`}
    >
      <Ionicons
        name={config.iconName}
        size={isSmall ? 10 : 12}
        color={config.color}
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: isSmall ? 11 : 12,
          },
        ]}
        numberOfLines={1}
      >
        {config.label}
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
