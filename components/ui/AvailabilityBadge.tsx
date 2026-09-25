import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

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
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const getConfig = () => {
    switch (status) {
      case 'AVAILABLE':
        return {
          label: 'Available',
          iconName: 'radio-button-on' as const,
          color: colors.success,
          bgColor: colors.successLight,
          borderColor: '#C6F6D5',
        };
      case 'LOW_STOCK':
        return {
          label: 'Low stock',
          iconName: 'alert-circle' as const,
          color: colors.warning,
          bgColor: colors.warningLight,
          borderColor: '#FEEBC8',
        };
      case 'SOLD_OUT':
        return {
          label: 'Sold out',
          iconName: 'close-circle' as const,
          color: colors.danger,
          bgColor: colors.errorLight,
          borderColor: '#FED7D7',
        };
      case 'UNKNOWN':
      default:
        return {
          label: 'Availability unconfirmed',
          iconName: 'help-circle' as const,
          color: colors.textMuted,
          bgColor: colors.surfaceSecondary,
          borderColor: colors.divider,
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
let styles = createStyles(lightColors);
