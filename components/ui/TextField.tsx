import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  required?: boolean;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  isPassword = false,
  clearable = false,
  onClear,
  containerStyle,
  inputStyle,
  required = false,
  value,
  onChangeText,
  editable = true,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  const hasError = !!error;
  const isClearVisible = clearable && !!value && editable;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required ? <Text style={styles.requiredMark}> *</Text> : null}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          isFocused ? styles.inputFocused : null,
          hasError ? styles.inputError : null,
          !editable ? styles.inputDisabled : null,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={hasError ? Colors.error : isFocused ? Colors.brandInk : Colors.textMuted}
            style={styles.leftIcon}
          />
        ) : null}

        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          editable={editable}
          accessible={true}
          accessibilityLabel={label || rest.placeholder}
          {...rest}
        />

        {isClearVisible ? (
          <TouchableOpacity
            onPress={() => {
              if (onClear) onClear();
              else if (onChangeText) onChangeText('');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.actionIcon}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Clear text"
          >
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.actionIcon}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.actionIcon}
          >
            <Ionicons name={rightIcon} size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {hasError ? (
        <View style={styles.feedbackRow}>
          <Ionicons name="alert-circle" size={14} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  labelRow: {
    marginBottom: Spacing.xxs + 2,
  },
  label: {
    ...Typography.labelLarge,
    color: Colors.brandInk,
  },
  requiredMark: {
    color: Colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
  },
  inputFocused: {
    borderColor: Colors.brandInk,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputDisabled: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.borderLight,
    opacity: 0.7,
  },
  leftIcon: {
    marginRight: Spacing.xs,
  },
  actionIcon: {
    padding: Spacing.xxs,
    marginLeft: Spacing.xxs,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.brandInk,
    paddingVertical: Spacing.sm,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xxs + 2,
    gap: 4,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
  },
  helperText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: Spacing.xxs + 2,
  },
});
