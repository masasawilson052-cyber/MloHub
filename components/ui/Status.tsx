import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { BranchOperationalMode } from '../../types/domain';

export type StatusType = 'OPEN' | 'BUSY' | 'PAUSED' | 'CLOSED' | 'AVAILABLE' | 'SOLD_OUT' | 'PENDING' | 'SUCCESS' | 'WARNING';

export interface StatusProps {
  status: StatusType | BranchOperationalMode | string;
  label?: string;
  busyDelayMinutes?: number;
  pauseReason?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export const Status: React.FC<StatusProps> = ({
  status,
  label,
  busyDelayMinutes,
  pauseReason,
  size = 'md',
  style,
}) => {
  const getConfig = () => {
    switch (status) {
      case 'OPEN':
      case 'AVAILABLE':
      case 'SUCCESS':
        return {
          dotColor: Colors.botanicalGreen,
          bg: Colors.botanicalGreenLight,
          textColor: Colors.botanicalGreen,
          defaultLabel: 'Open Now',
        };
      case 'BUSY':
        return {
          dotColor: Colors.warning,
          bg: Colors.warningLight,
          textColor: Colors.warningDark,
          defaultLabel: busyDelayMinutes ? `Busy (+${busyDelayMinutes}m)` : 'High Demand',
        };
      case 'PAUSED':
        return {
          dotColor: Colors.warning,
          bg: Colors.warningLight,
          textColor: Colors.warningDark,
          defaultLabel: pauseReason || 'Pausing New Orders',
        };
      case 'CLOSED':
      case 'SOLD_OUT':
      case 'UNAVAILABLE':
        return {
          dotColor: Colors.error,
          bg: Colors.errorLight,
          textColor: Colors.error,
          defaultLabel: status === 'SOLD_OUT' ? 'Sold Out' : 'Closed',
        };
      default:
        return {
          dotColor: Colors.textMuted,
          bg: Colors.surfaceSecondary,
          textColor: Colors.textSecondary,
          defaultLabel: String(status),
        };
    }
  };

  const config = getConfig();
  const displayLabel = label || config.defaultLabel;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: config.bg },
        size === 'sm' && styles.containerSm,
        style,
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${displayLabel}`}
    >
      <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
      <Text
        style={[
          styles.text,
          { color: config.textColor },
          size === 'sm' && styles.textSm,
        ]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </View>
  );
};

// Also export AvailabilityBadge for backward compatibility
export const AvailabilityBadge = Status;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.full,
    gap: 5,
    alignSelf: 'flex-start',
  },
  containerSm: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    ...Typography.labelSmall,
    fontWeight: '700',
    fontSize: 11,
  },
  textSm: {
    fontSize: 10,
  },
});
