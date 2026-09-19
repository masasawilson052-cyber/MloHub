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
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

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
  const content = (
    <View style={[styles.container, style]}>
      {leftContent ? (
        <View style={styles.leftWrapper}>{leftContent}</View>
      ) : leftIcon ? (
        <View style={styles.iconCircle}>
          <Ionicons
            name={leftIcon}
            size={20}
            color={destructive ? Colors.error : leftIconColor || Colors.brandInk}
          />
        </View>
      ) : null}

      <View style={styles.textColumn}>
        <Text style={[styles.title, destructive ? styles.destructiveText : null]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {rightContent ? <View style={styles.rightWrapper}>{rightContent}</View> : null}

      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  leftWrapper: {
    marginRight: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
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
    color: Colors.brandInk,
    fontWeight: '500',
  },
  destructiveText: {
    color: Colors.error,
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rightWrapper: {
    marginLeft: Spacing.sm,
    marginRight: Spacing.xs,
  },
});
