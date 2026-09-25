import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  leftIconColor?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  leftIcon,
  leftIconColor,
  leftContent,
  rightContent,
  showChevron = true,
  onPress,
  destructive = false,
  style,
  disabled = false,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.divider,
        },
        style,
      ]}
    >
      {leftContent ? (
        <View style={styles.leftWrapper}>{leftContent}</View>
      ) : leftIcon ? (
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: colors.surfaceInteractive },
          ]}
        >
          <Ionicons
            name={leftIcon}
            size={20}
            color={destructive ? colors.danger : leftIconColor || colors.textPrimary}
          />
        </View>
      ) : null}

      <View style={styles.textColumn}>
        <Text
          style={[
            styles.title,
            { color: destructive ? colors.danger : colors.textPrimary },
            destructive && styles.destructiveText,
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightContent ? <View style={styles.rightWrapper}>{rightContent}</View> : null}

      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
    borderBottomWidth: 1,
  },
  leftWrapper: {
    marginRight: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...Typography.bodyLarge,
    fontWeight: '500',
  },
  destructiveText: {
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  rightWrapper: {
    marginLeft: Spacing.sm,
    marginRight: Spacing.xs,
  },
});
let styles = createStyles(lightColors);
