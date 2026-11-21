import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ImageStyle,
  ViewStyle,
  ImageSourcePropType,
  Platform,
} from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { resolveSizedImageUrl, IMAGE_SIZES } from '../../utils/imageUrlResolver';

const MLOHUB_LOGO = require('../../assets/icon.png');
// Neutral warm food placeholder blurhash
const DEFAULT_BLURHASH = 'L5H2EC=PM+yV0g-mq.wG9c010J}q';

// Inlined lightweight SVG data URI for web to avoid unwanted HTTP 404 requests to relative BlurHash paths
const PLACEHOLDER_DATA_URI =
  'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2010%2010%22%3E%3Crect%20width%3D%2210%22%20height%3D%2210%22%20fill%3D%22%23F1F5F9%22%2F%3E%3C%2Fsvg%3E';

const RESOLVED_PLACEHOLDER =
  Platform.OS === 'web' ? PLACEHOLDER_DATA_URI : { blurhash: DEFAULT_BLURHASH };

export interface FoodImageProps {
  source?: string | ImageSourcePropType | null;
  cardSource?: string | null;
  targetWidth?: number;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  priority?: 'low' | 'normal' | 'high';
  isAboveFold?: boolean;
  alt?: string;
  accessibilityLabel?: string;
  testID?: string;
  borderRadius?: number;
  fallbackIconSize?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export const FoodImage: React.FC<FoodImageProps> = ({
  source,
  cardSource,
  targetWidth = IMAGE_SIZES.CARD,
  style,
  contentFit,
  resizeMode,
  priority,
  isAboveFold,
  alt,
  accessibilityLabel,
  testID,
  borderRadius,
  fallbackIconSize = 36,
  onLoad,
  onError,
}) => {
  const { colors } = useTheme();
  const [hasError, setHasError] = useState(false);

  // Map legacy resizeMode to contentFit if contentFit is not explicitly provided
  const resolvedContentFit: ImageContentFit =
    contentFit ||
    (resizeMode === 'cover'
      ? 'cover'
      : resizeMode === 'contain'
      ? 'contain'
      : resizeMode === 'stretch'
      ? 'fill'
      : resizeMode === 'center'
      ? 'none'
      : 'cover');

  // Priority resolution: explicitly passed > isAboveFold ? 'high' : 'low'
  const resolvedPriority = priority || (isAboveFold ? 'high' : 'low');

  // Resolve source URI
  let finalSource: any = null;

  if (cardSource && typeof cardSource === 'string' && cardSource.trim().length > 0) {
    finalSource = { uri: cardSource.trim() };
  } else if (typeof source === 'string' && source.trim().length > 0) {
    const resolved = resolveSizedImageUrl(source.trim(), { width: targetWidth });
    finalSource = { uri: resolved || source.trim() };
  } else if (typeof source === 'number') {
    finalSource = source;
  } else if (source && typeof source === 'object' && 'uri' in source && source.uri) {
    const uri = (source as any).uri;
    const resolved = resolveSizedImageUrl(uri, { width: targetWidth });
    finalSource = { ...(source as any), uri: resolved || uri };
  }

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const effectiveBorderRadius = borderRadius ?? (flattenedStyle as any).borderRadius ?? 0;

  if (!finalSource || hasError) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surfaceInteractive,
            borderRadius: effectiveBorderRadius,
          },
          style as StyleProp<ViewStyle>,
        ]}
        testID={testID ? `${testID}-fallback` : undefined}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel || alt || 'MloHub food placeholder'}
      >
        <ExpoImage
          source={MLOHUB_LOGO}
          style={[
            styles.fallbackLogo,
            {
              width: fallbackIconSize,
              height: fallbackIconSize,
            },
          ]}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="low"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceInteractive,
          borderRadius: effectiveBorderRadius,
        },
        style as StyleProp<ViewStyle>,
      ]}
    >
      <ExpoImage
        source={finalSource}
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: effectiveBorderRadius,
          },
          style,
        ]}
        contentFit={resolvedContentFit}
        placeholder={RESOLVED_PLACEHOLDER}
        transition={{ duration: 250 }}
        cachePolicy="memory-disk"
        priority={resolvedPriority}
        testID={testID}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel || alt}
        onLoad={() => {
          onLoad?.();
        }}
        onError={() => {
          setHasError(true);
          onError?.();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackLogo: {
    opacity: 0.55,
  },
});
export default FoodImage;
