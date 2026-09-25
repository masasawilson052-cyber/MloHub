import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { OrderStatus } from '../../types/domain';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type OrderTrackingStatus =
  | OrderStatus
  | 'Pending Confirmation'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready for Pickup'
  | 'Out for Delivery'
  | 'Completed'
  | 'Cancelled'
  | string;

export interface OrderTrackingTimelineProps {
  status: OrderTrackingStatus;
  style?: StyleProp<ViewStyle>;
  estimatedMinutes?: number;
}

const STEPS: { status: OrderStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { status: 'PENDING', label: 'Received', icon: 'time-outline' },
  { status: 'ACCEPTED', label: 'Accepted', icon: 'checkmark-circle-outline' },
  { status: 'PREPARING', label: 'Cooking', icon: 'flame-outline' },
  { status: 'READY', label: 'Ready', icon: 'bag-check-outline' },
  { status: 'OUT_FOR_DELIVERY', label: 'On Way', icon: 'bicycle-outline' },
  { status: 'COMPLETED', label: 'Completed', icon: 'checkmark-done-circle-outline' },
];

export const OrderTrackingTimeline: React.FC<OrderTrackingTimelineProps> = ({
  status,
  style,
  estimatedMinutes,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const getStepIndex = (s: OrderTrackingStatus): number => {
    switch (s) {
      case 'Pending Confirmation':
      case 'PENDING':
        return 0;
      case 'Confirmed':
      case 'ACCEPTED':
        return 1;
      case 'Preparing':
      case 'PREPARING':
        return 2;
      case 'Ready for Pickup':
      case 'READY':
        return 3;
      case 'Out for Delivery':
      case 'OUT_FOR_DELIVERY':
        return 4;
      case 'Completed':
      case 'COMPLETED':
        return 5;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(status);

  return (
    <View style={[styles.container, style]}>
      {estimatedMinutes ? (
        <View style={styles.etaHeader}>
          <Text style={styles.etaLabel}>Estimated Kitchen Preparation</Text>
          <Text style={styles.etaTime}>~{estimatedMinutes} mins</Text>
        </View>
      ) : null}

      <View style={styles.timelineRow}>
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <React.Fragment key={step.status}>
              {/* Step Node */}
              <View style={styles.stepCol}>
                <View
                  style={[
                    styles.nodeCircle,
                    isDone && styles.nodeDone,
                    isCurrent && styles.nodeCurrent,
                  ]}
                  accessible={true}
                  accessibilityLabel={`${step.label}: ${isCurrent ? 'Current' : isDone ? 'Completed' : 'Pending'}`}
                >
                  <Ionicons
                    name={isDone ? 'checkmark' : step.icon}
                    size={14}
                    color={isDone || isCurrent ? colors.white : colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    (isDone || isCurrent) && styles.stepLabelActive,
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {/* Connecting Bar */}
              {idx < STEPS.length - 1 && (
                <View
                  style={[
                    styles.connectingLine,
                    idx < currentIndex && styles.connectingLineDone,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  etaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  etaLabel: {
    ...Typography.Caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  etaTime: {
    ...Typography.H3,
    color: colors.primary,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  stepCol: {
    alignItems: 'center',
    width: 50,
  },
  nodeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceInteractive,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  nodeDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  nodeCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  connectingLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.divider,
    marginTop: -16,
    marginHorizontal: -4,
  },
  connectingLineDone: {
    backgroundColor: colors.success,
  },
});
let styles = createStyles(lightColors);
