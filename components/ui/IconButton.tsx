import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Radii } from '../../theme/radius';

export type IconButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'surface';

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: number; // Outer container size, defaults to 44 or 48
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'ghost',
  size = 48,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: Colors.primary };
      case 'secondary':
        return { backgroundColor: Colors.primaryMuted };
      case 'surface':
        return { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight };
      case 'outline':
        return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.border };
      case 'ghost':
      default:
        return { backgroundColor: 'transparent' };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        getVariantStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? Colors.white : Colors.primary} />
      ) : (
        icon
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
