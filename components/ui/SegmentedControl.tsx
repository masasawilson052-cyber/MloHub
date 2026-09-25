import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

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
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="radiogroup"
    >
      {options.map((option) => {
        const isSelected = option.value === selectedValue;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segment,
              isSelected && {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
            onPress={() => onValueChange(option.value)}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
          >
            <Text
              style={[
                styles.label,
                { color: isSelected ? colors.textPrimary : colors.textSecondary },
                isSelected && styles.selectedLabel,
              ]}
            >
              {option.label}
            </Text>
            {option.badge !== undefined && option.badge !== null ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isSelected
                      ? colors.primarySoft
                      : colors.surfaceInteractive,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                  ]}
                >
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Radii.lg,
    padding: Spacing.xxs,
    borderWidth: 1,
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
  label: {
    ...Typography.bodyMedium,
    fontWeight: '500',
  },
  selectedLabel: {
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  badgeText: {
    ...Typography.labelSmall,
    fontWeight: '700',
  },
});
let styles = createStyles(lightColors);
