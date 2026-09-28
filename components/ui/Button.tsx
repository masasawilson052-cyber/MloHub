import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  accessibilityLabel,
  fullWidth = false,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  const getContainerStyle = (): ViewStyle[] => {
    const stylesList: ViewStyle[] = [styles.base];

    if (fullWidth) stylesList.push(styles.fullWidth);

    switch (size) {
      case 'sm':
        stylesList.push(styles.sizeSm);
        break;
      case 'lg':
        stylesList.push(styles.sizeLg);
        break;
      case 'md':
      default:
        stylesList.push(styles.sizeMd);
        break;
    }

    switch (variant) {
      case 'secondary':
        stylesList.push({
          backgroundColor: colors.surfaceInteractive,
          borderWidth: 1,
          borderColor: colors.border,
        });
        break;
      case 'outline':
        stylesList.push({
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary,
        });
        break;
      case 'ghost':
        stylesList.push({ backgroundColor: 'transparent' });
        break;
      case 'danger':
        stylesList.push({ backgroundColor: colors.danger });
        break;
      case 'primary':
      default:
        stylesList.push({ backgroundColor: colors.primaryCta });
        break;
    }

    if (disabled || loading) {
      stylesList.push(styles.disabled);
    }

    return stylesList;
  };

  const getTextStyle = (): TextStyle[] => {
    const stylesList: TextStyle[] = [styles.textBase];

    switch (size) {
      case 'sm':
        stylesList.push(styles.textSm);
        break;
      case 'lg':
        stylesList.push(styles.textLg);
        break;
      case 'md':
      default:
        stylesList.push(styles.textMd);
        break;
    }

    switch (variant) {
      case 'secondary':
        stylesList.push({ color: colors.textPrimary });
        break;
      case 'outline':
        stylesList.push({ color: colors.primary });
        break;
      case 'ghost':
        stylesList.push({ color: colors.primary });
        break;
      case 'danger':
        stylesList.push({ color: colors.onPrimary });
        break;
      case 'primary':
      default:
        stylesList.push({ color: colors.onPrimary });
        break;
    }

    if (disabled) {
      stylesList.push({ color: colors.textMuted });
    }

    return stylesList;
  };

  const spinnerColor =
    variant === 'outline' || variant === 'ghost' || variant === 'secondary'
      ? colors.primary
      : colors.card;

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' ? <>{icon}</> : null}
          <Text
            style={[
              getTextStyle(),
              icon
                ? iconPosition === 'left'
                  ? styles.iconLeftMargin
                  : styles.iconRightMargin
                : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' ? <>{icon}</> : null}
        </>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  sizeSm: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    minHeight: 38,
  },
  sizeMd: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
  },
  sizeLg: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    minHeight: 54,
  },
  disabled: {
    opacity: 0.55,
  },
  textBase: {
    fontWeight: '600',
    textAlign: 'center',
  },
  textSm: {
    fontSize: 13,
  },
  textMd: {
    fontSize: 15,
  },
  textLg: {
    fontSize: 16,
  },
  iconLeftMargin: {
    marginLeft: Spacing.xs,
  },
  iconRightMargin: {
    marginRight: Spacing.xs,
  },
});
let styles = createStyles(lightColors);
