import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

export interface DividerProps {
  label?: string;
  orientation?: 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
  color?: string;
  marginVertical?: number;
}

export const Divider: React.FC<DividerProps> = ({
  label,
  orientation = 'horizontal',
  style,
  color = Colors.borderLight,
  marginVertical = Spacing.md,
}) => {
  if (orientation === 'vertical') {
    return <View style={[styles.vertical, { backgroundColor: color }, style]} />;
  }

  if (label) {
    return (
      <View style={[styles.labelWrapper, { marginVertical }, style]}>
        <View style={[styles.line, { backgroundColor: color }]} />
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.line, { backgroundColor: color }]} />
      </View>
    );
  }

  return <View style={[styles.horizontal, { backgroundColor: color, marginVertical }, style]} />;
};

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    width: '100%',
  },
  vertical: {
    width: 1,
    height: '100%',
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
