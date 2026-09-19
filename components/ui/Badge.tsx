import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'accent';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  style,
  textStyle,
  size = 'md',
}) => {
  const getColors = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'success':
        return { bg: Colors.successLight, text: Colors.success, border: Colors.successLight };
      case 'warning':
        return { bg: Colors.warningLight, text: Colors.warning, border: Colors.warningLight };
      case 'error':
        return { bg: Colors.errorLight, text: Colors.error, border: Colors.errorLight };
      case 'info':
        return { bg: Colors.infoLight, text: Colors.info, border: Colors.infoLight };
      case 'primary':
        return { bg: Colors.primaryMuted, text: Colors.primaryDark, border: Colors.primaryMuted };
      case 'accent':
        return { bg: Colors.accentLight, text: Colors.accentDark, border: Colors.accentLight };
      case 'neutral':
      default:
        return { bg: Colors.surfaceSecondary, text: Colors.textSecondary, border: Colors.borderLight };
    }
  };

  const { bg, text, border } = getColors();

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        { backgroundColor: bg, borderColor: border || bg },
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: text },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  sizeSm: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
  },
  sizeMd: {
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
    lineHeight: 14,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
  },
});
