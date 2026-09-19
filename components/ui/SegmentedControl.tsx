import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Shadows } from '../../theme/shadows';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number | string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string = string>({
  options,
  selectedValue,
  onValueChange,
  style,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]} accessible={true} accessibilityRole="radiogroup">
      {options.map((option) => {
        const isSelected = option.value === selectedValue;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.segment, isSelected ? styles.selectedSegment : null]}
            onPress={() => onValueChange(option.value)}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
          >
            <Text style={[styles.label, isSelected ? styles.selectedLabel : null]}>
              {option.label}
            </Text>
            {option.badge !== undefined && option.badge !== null ? (
              <View style={[styles.badge, isSelected ? styles.selectedBadge : null]}>
                <Text style={[styles.badgeText, isSelected ? styles.selectedBadgeText : null]}>
                  {option.badge}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.lg,
    padding: Spacing.xxs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md,
    minHeight: 40,
    gap: 6,
  },
  selectedSegment: {
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  label: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  selectedLabel: {
    color: Colors.brandInk,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  selectedBadge: {
    backgroundColor: Colors.primaryMuted,
  },
  badgeText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  selectedBadgeText: {
    color: Colors.brandInk,
    fontWeight: '700',
  },
});
