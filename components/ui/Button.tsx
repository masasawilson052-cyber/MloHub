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
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';

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
  const getContainerStyle = (): ViewStyle[] => {
    const stylesList: ViewStyle[] = [styles.base];

    if (fullWidth) stylesList.push(styles.fullWidth);

    // Size
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

    // Variant
    switch (variant) {
      case 'secondary':
        stylesList.push(styles.secondary);
        break;
      case 'outline':
        stylesList.push(styles.outline);
        break;
      case 'ghost':
        stylesList.push(styles.ghost);
        break;
      case 'danger':
        stylesList.push(styles.danger);
        break;
      case 'primary':
      default:
        stylesList.push(styles.primary);
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
        stylesList.push(styles.textSecondary);
        break;
      case 'outline':
        stylesList.push(styles.textOutline);
        break;
      case 'ghost':
        stylesList.push(styles.textGhost);
        break;
      case 'danger':
        stylesList.push(styles.textDanger);
        break;
      case 'primary':
      default:
        stylesList.push(styles.textPrimary);
        break;
    }

    if (disabled) {
      stylesList.push(styles.textDisabled);
    }

    return stylesList;
  };

  const spinnerColor = variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white;

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
          <Text style={[getTextStyle(), icon ? (iconPosition === 'left' ? styles.iconLeftMargin : styles.iconRightMargin) : null, textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' ? <>{icon}</> : null}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
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
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.primaryMuted,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.error,
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
  textPrimary: {
    color: Colors.white,
  },
  textSecondary: {
    color: Colors.primaryDark,
  },
  textOutline: {
    color: Colors.primary,
  },
  textGhost: {
    color: Colors.primary,
  },
  textDanger: {
    color: Colors.white,
  },
  textDisabled: {
    color: Colors.disabledText,
  },
  iconLeftMargin: {
    marginLeft: Spacing.xs,
  },
  iconRightMargin: {
    marginRight: Spacing.xs,
  },
});
