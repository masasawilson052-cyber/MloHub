import React, { useState } from 'react';
import {
  View,
  Image as RNImage,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageSourcePropType,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Radii } from '../../theme/radius';

export interface AppImageProps {
  source?: ImageSourcePropType | string | null;
  aspectRatio?: number; // e.g. 4/3 or 16/9 or 1
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export const AppImage: React.FC<AppImageProps> = ({
  source,
  aspectRatio = 4 / 3,
  borderRadius = Radii.md,
  style,
  fallbackIcon = 'restaurant-outline',
  accessibilityLabel = 'Image',
  resizeMode = 'cover',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const imageUri = typeof source === 'string' && source.trim().length > 0 ? { uri: source } : null;

  if (!imageUri || hasError) {
    return (
      <View
        style={[
          styles.placeholder,
          { aspectRatio, borderRadius },
          style,
        ]}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`${accessibilityLabel} placeholder`}
      >
        <Ionicons name={fallbackIcon} size={28} color={Colors.textMuted} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { aspectRatio, borderRadius }, style]}>
      <RNImage
        source={imageUri}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        resizeMode={resizeMode}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      />
      {isLoading ? (
        <View style={[styles.loadingOverlay, { borderRadius }]}>
          <ActivityIndicator size="small" color={Colors.brandInk} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.surfaceSecondary,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    width: '100%',
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
