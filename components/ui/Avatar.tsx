import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle, ImageSourcePropType } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  source?: ImageSourcePropType | string | null;
  name?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
};

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size = 'md',
  style,
}) => {
  const dimension = SIZE_MAP[size];
  const borderRadius = dimension / 2;

  const getInitials = (str?: string): string => {
    if (!str) return 'M';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const imageUri = typeof source === 'string' ? { uri: source } : source;

  return (
    <View
      style={[
        styles.base,
        {
          width: dimension,
          height: dimension,
          borderRadius,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={name ? `Avatar for ${name}` : 'User avatar'}
    >
      {imageUri ? (
        <Image
          source={imageUri}
          style={{ width: dimension, height: dimension, borderRadius }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={[
            styles.initials,
            size === 'sm' && styles.initialsSm,
            size === 'lg' && styles.initialsLg,
            size === 'xl' && styles.initialsXl,
          ]}
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.brandInk,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    ...Typography.labelLarge,
    color: Colors.white,
    fontWeight: '700',
  },
  initialsSm: {
    fontSize: 11,
  },
  initialsLg: {
    fontSize: 18,
  },
  initialsXl: {
    fontSize: 24,
  },
});
